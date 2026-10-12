import { isDeepStrictEqual } from 'node:util';

import { z } from 'zod';

import { EntityConflictError, EntityInUseError, EntityValidationError, WorkspaceReferenceError } from './errors';
import { entityId } from '../../shared/entities';
import { isForeignKeyViolation, isUniqueViolation } from '../database/errors';
import { newId } from '../database/ids';
import { fromBoolean, fromJson, fromTimestamp, toBoolean, toJson, toTimestamp } from '../database/serialize';

import type { Dependent, EntityIssue } from './errors';
import type { EntitySchema } from '../../shared/entities';
import type { Database } from '../database/types/schema';
import type { ExtensionRegistry } from '../extensions/registry';
import type { KindEntity } from '@stackmap/extension-sdk';
import type { Kysely } from 'kysely';

/** Tells which kinds the active extensions provide. */
export type KindCatalog = Pick<ExtensionRegistry, 'hasKind'>;

/** Who the repositories act for: one workspace, one user (none before accounts exist, or for the system). */
export interface RepositoryScope {
  workspaceId: string;
  actorId: string | null;
  kinds: KindCatalog;
}

/** Reads and writes one entity type of one workspace; nothing outside that workspace is visible. */
export interface ScopedRepository<Entity, Input, Patch, Filter extends object = never> {
  create: (input: Input) => Promise<Entity>;
  /** Undefined when the workspace has no such entity. */
  get: (id: string) => Promise<Entity | undefined>;
  /** In creation order. */
  list: (filter?: Filter) => Promise<Entity[]>;
  /** Undefined when the workspace has no such entity. */
  update: (id: string, patch: Patch) => Promise<Entity | undefined>;
  /** False when the workspace has no such entity. */
  remove: (id: string) => Promise<boolean>;
}

export type EntityTable = 'site' | 'network' | 'host' | 'service' | 'listener' | 'domain' | 'dnsRecord';

/** The connection (or transaction) repositories use, and their scope. */
export interface RepositoryContext {
  db: Kysely<Database>;
  scope: RepositoryScope;
}

/** A field that refers to another entity, which must be in the same workspace. */
export interface EntityReference {
  /** Dotted path of the field: `siteId`, `addresses.1.networkId`. */
  field: string;
  table: EntityTable;
  id: string;
}

type Row = Record<string, unknown>;

/** How an entity is stored, checked and completed. Values are handled as plain records inside the repository. */
export interface EntityDefinition<Fields, Input> {
  table: EntityTable;
  schema: EntitySchema<Fields, Input>;
  /** The columns of its own fields, besides the common ones. */
  columns: readonly string[];
  /** Fields stored in tables the entity owns, such as a host's addresses. */
  ownedFields?: readonly string[];
  /** Columns stored as 0/1. */
  booleans?: readonly string[];
  /** Fields holding a kind, and the entity whose kinds they are. */
  kinds?: Readonly<Record<string, KindEntity>>;
  /** Columns `list` can filter on. */
  filters?: readonly string[];
  /** Fields whose combination is unique in the workspace, reported on a conflict. */
  unique?: readonly string[];
  references?: (fields: Fields) => EntityReference[];
  /** Rows of other tables that refer to this entity and prevent removing it. */
  dependents?: readonly { table: keyof Database; column: string }[];
  /** Checks that need the database, on the changed fields. */
  check?: (context: RepositoryContext, fields: Fields, changed: ReadonlySet<string>) => Promise<EntityIssue[]>;
  /** Writes the rows the entity owns, when their fields changed. */
  writeOwned?: (context: RepositoryContext, id: string, fields: Fields, changed: ReadonlySet<string>) => Promise<void>;
  /** Adds owned and derived fields to entities read from the table. */
  expand?: (context: RepositoryContext, entities: Row[]) => Promise<Row[]>;
}

const COMMON_COLUMNS = ['status', 'tags', 'notes', 'links', 'customFields', 'origin', 'externalRef'];
const JSON_COLUMNS = new Set(['tags', 'links', 'customFields']);
const TIMESTAMP_COLUMNS = new Set(['createdAt', 'updatedAt']);
const META_COLUMNS = ['id', 'workspaceId', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt'];

/** Runs the work in a transaction, or in the caller's transaction when there is one. */
export function inTransaction<T>(db: Kysely<Database>, work: (trx: Kysely<Database>) => Promise<T>): Promise<T> {
  return db.isTransaction ? work(db) : db.transaction().execute(work);
}

/** The definitions name their tables and columns at runtime; their types come from the entity schemas. */
const loose = (db: Kysely<Database>) => db as unknown as Kysely<Record<string, Row>>;

/** The parsed value, or an EntityValidationError listing every issue. */
export function parseEntity<T, I>(schema: z.ZodType<T, I>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues.map(({ path, message }) => ({ path: path.map(String).join('.'), message }));
    throw new EntityValidationError(issues);
  }
  return result.data;
}

/** Ids are UUIDs: anything else finds nothing, without a query. */
const isId = (id: unknown): id is string => entityId().safeParse(id).success;

const pick = (source: Row, keys: readonly string[]): Row =>
  Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));

/** A repository factory for an entity: every query is limited to the scope's workspace and selects named columns. */
export function defineEntityRepository<Entity, Fields, Input, Patch, Filter extends object = never>(
  definition: EntityDefinition<Fields, Input>,
): (context: RepositoryContext) => ScopedRepository<Entity, Input, Patch, Filter> {
  const { table } = definition;
  for (const column of [...definition.columns, ...(definition.filters ?? []), ...(definition.ownedFields ?? [])]) {
    if (META_COLUMNS.includes(column)) {
      throw new Error(`The ${table} repository cannot store, filter or own ${column}: the repository sets it.`);
    }
  }
  const filterSchema = z.strictObject(
    Object.fromEntries((definition.filters ?? []).map((field) => [field, entityId().optional()])),
  );
  const stored = [...COMMON_COLUMNS, ...definition.columns];
  const selected = [...META_COLUMNS, ...stored];
  const inputFields = [...stored, ...(definition.ownedFields ?? [])];
  const booleans = new Set(definition.booleans);

  const toRow = (fields: Row): Row => Object.fromEntries(stored.map((column) => {
    const value = fields[column];
    if (JSON_COLUMNS.has(column)) {
      return [column, toJson(value)];
    }
    return [column, booleans.has(column) ? toBoolean(value as boolean) : value];
  }));

  const fromRow = (row: Row): Row => Object.fromEntries(selected.map((column) => {
    const value = row[column];
    const name = `${table}.${column}`;
    if (JSON_COLUMNS.has(column)) {
      return [column, fromJson(value as string, name)];
    }
    if (TIMESTAMP_COLUMNS.has(column)) {
      return [column, fromTimestamp(value as string, name)];
    }
    return [column, booleans.has(column) ? fromBoolean(value as number, name) : value];
  }));

  return ({ db, scope }) => {
    const contextOf = (trx: Kysely<Database>): RepositoryContext => ({ db: trx, scope });

    const find = async (trx: Kysely<Database>, where: Row): Promise<Row[]> => {
      let query = loose(trx).selectFrom(table).select(selected).where('workspaceId', '=', scope.workspaceId);
      for (const [column, value] of Object.entries(where)) {
        query = query.where(column, '=', value);
      }
      const entities = (await query.orderBy('id').execute()).map(fromRow);
      return definition.expand ? definition.expand(contextOf(trx), entities) : entities;
    };

    const checkKinds = (fields: Row, changed: ReadonlySet<string>) => {
      const issues = Object.entries(definition.kinds ?? {}).flatMap(([field, entity]) => {
        const kind = fields[field];
        return changed.has(field) && typeof kind === 'string' && !scope.kinds.hasKind(entity, kind)
          ? [{ path: field, message: `No active extension provides the ${entity} kind "${kind}"` }]
          : [];
      });
      if (issues.length > 0) {
        throw new EntityValidationError(issues);
      }
    };

    const checkReferences = async (trx: Kysely<Database>, references: EntityReference[]) => {
      for (const { field, table: target, id } of references) {
        const found = await loose(trx).selectFrom(target).select('id')
          .where('workspaceId', '=', scope.workspaceId)
          .where('id', '=', id)
          .executeTakeFirst();
        if (!found) {
          throw new WorkspaceReferenceError(field, id);
        }
      }
    };

    /** Checks what needs the database, then writes the row and the rows the entity owns. */
    const save = async (
      trx: Kysely<Database>,
      id: string,
      fields: Row,
      changed: ReadonlySet<string>,
      write: () => Promise<unknown>,
    ) => {
      const typed = fields as Fields;
      const references = (definition.references?.(typed) ?? []).filter(({ field }) => changed.has(field.split('.')[0] ?? ''));
      await checkReferences(trx, references);
      const issues = await definition.check?.(contextOf(trx), typed, changed) ?? [];
      if (issues.length > 0) {
        throw new EntityValidationError(issues);
      }
      try {
        await write();
      } catch (error) {
        if (definition.unique && isUniqueViolation(error)) {
          throw new EntityConflictError([...definition.unique]);
        }
        throw error;
      }
      await definition.writeOwned?.(contextOf(trx), id, typed, changed);
      const [saved] = await find(trx, { id });
      return saved as Entity;
    };

    const countDependents = async (trx: Kysely<Database>, id: string): Promise<Dependent[]> => {
      const counts = await Promise.all((definition.dependents ?? []).map(async ({ table: dependent, column }) => {
        const row = await loose(trx).selectFrom(dependent)
          .select((expression) => expression.fn.countAll().as('count'))
          .where('workspaceId', '=', scope.workspaceId)
          .where(column, '=', id)
          .executeTakeFirst();
        return { entity: dependent, count: Number(row?.count ?? 0) };
      }));
      return counts.filter(({ count }) => count > 0);
    };

    return {
      create: async (input) => {
        const fields = parseEntity(definition.schema.input, input) as Row;
        const changed = new Set(inputFields);
        checkKinds(fields, changed);
        return inTransaction(db, async (trx) => {
          const id = newId();
          const now = toTimestamp(new Date());
          // The id, workspace and audit fields last: no stored field can override them.
          return save(trx, id, fields, changed, () => loose(trx).insertInto(table).values({
            ...toRow(fields),
            id,
            workspaceId: scope.workspaceId,
            createdBy: scope.actorId,
            updatedBy: scope.actorId,
            createdAt: now,
            updatedAt: now,
          }).execute());
        });
      },

      get: async (id) => (isId(id) ? (await find(db, { id }))[0] as Entity | undefined : undefined),

      list: async (filter) => {
        const where = parseEntity(filterSchema, filter ?? {}) as Row;
        return (await find(db, pick(where, definition.filters ?? []))) as Entity[];
      },

      update: async (id, patch) => {
        const changes = parseEntity(definition.schema.patch, patch) as Row;
        if (!isId(id)) {
          return undefined;
        }
        return inTransaction(db, async (trx) => {
          const [current] = await find(trx, { id });
          if (!current) {
            return undefined;
          }
          const fields = parseEntity(definition.schema.input, { ...pick(current, inputFields), ...changes }) as Row;
          // An unchanged kind stays valid when its extension is turned off: data is never lost to a toggle.
          const changed = new Set(Object.keys(changes).filter((key) => !isDeepStrictEqual(fields[key], current[key])));
          checkKinds(fields, changed);
          return save(trx, id, fields, changed, () => loose(trx).updateTable(table)
            .set({ ...toRow(fields), updatedBy: scope.actorId, updatedAt: toTimestamp(new Date()) })
            .where('workspaceId', '=', scope.workspaceId)
            .where('id', '=', id)
            .execute());
        });
      },

      remove: async (id) => {
        if (!isId(id)) {
          return false;
        }
        const dependents = await countDependents(db, id);
        if (dependents.length > 0) {
          throw new EntityInUseError(dependents);
        }
        try {
          const { numDeletedRows } = await loose(db).deleteFrom(table)
            .where('workspaceId', '=', scope.workspaceId)
            .where('id', '=', id)
            .executeTakeFirstOrThrow();
          return numDeletedRows > 0n;
        } catch (error) {
          // A dependent added since the count. Inside a transaction, Postgres refuses any query after the failure.
          if (isForeignKeyViolation(error)) {
            throw new EntityInUseError(db.isTransaction ? [] : await countDependents(db, id));
          }
          throw error;
        }
      },
    };
  };
}
