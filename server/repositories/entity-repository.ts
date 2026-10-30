import { isDeepStrictEqual } from 'node:util';

import { isExtensionTable } from '@stackmap/extension-sdk';
import { ENTITY_META_FIELDS, entityId } from '@stackmap/extension-sdk/entities';
import { sql } from 'kysely';
import { z } from 'zod';

import {
  EntityChangedError, EntityConflictError, EntityInUseError, EntityValidationError, parseEntity,
  WorkspaceReferenceError,
} from './errors';
import { isForeignKeyViolation, isUniqueViolation } from '../database/errors';
import { newId } from '../database/ids';
import { fromBoolean, fromJson, fromTimestamp, toBoolean, toJson, toTimestamp } from '../database/serialize';

import type { Dependent } from './errors';
import type { Database } from '../database/types/schema';
import type {
  EntityReference, EntityRepositoryDefinition, RepositoryContext as DefinitionContext, RepositoryScope,
  ScopedRepository,
} from '@stackmap/extension-sdk/server';
import type { Kysely } from 'kysely';

/** The connection (or transaction) a repository uses, and its scope. */
export interface RepositoryContext {
  db: Kysely<Database>;
  scope: RepositoryScope;
}

type Row = Record<string, unknown>;

const COMMON_COLUMNS = ['status', 'tags', 'notes', 'links', 'customFields', 'origin', 'externalRef'];
const JSON_COLUMNS = new Set(['tags', 'links', 'customFields']);
const TIMESTAMP_COLUMNS = new Set(['createdAt', 'updatedAt']);
const META_COLUMNS: readonly string[] = ENTITY_META_FIELDS;

/** Runs the work in a transaction, or in the caller's transaction when there is one. */
export function inTransaction<T>(db: Kysely<Database>, work: (trx: Kysely<Database>) => Promise<T>): Promise<T> {
  return db.isTransaction ? work(db) : db.transaction().execute(work);
}

/** The definitions name their tables and columns at runtime; their types come from the entity schemas. */
const loose = (db: Kysely<Database>) => db as unknown as Kysely<Record<string, Row>>;

/** Ids are UUIDs: anything else finds nothing, without a query. */
const isId = (id: unknown): id is string => entityId().safeParse(id).success;

const pick = (source: Row, keys: readonly string[]): Row =>
  Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));

/**
 * Builds the repository of an entity from its definition: every query is limited to the scope's workspace and selects
 * named columns.
 */
export function createEntityRepository<Fields, Input, DB>(
  definition: EntityRepositoryDefinition<Fields, Input, DB> & { tableOwners?: readonly string[] },
): (context: RepositoryContext) => ScopedRepository<unknown, unknown, unknown, object> {
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

  const toRow = (fields: Row, columns: readonly string[] = stored): Row => Object.fromEntries(columns.map((column) => {
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
    // The definition's callbacks query the extension's own tables, which the platform's types do not know.
    const contextOf = (trx: Kysely<Database>) => ({ db: trx, scope, newId }) as unknown as DefinitionContext<DB>;

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
        // An extension refers to its own tables and its dependencies', never to the platform's or another's.
        if (definition.tableOwners && !definition.tableOwners.some((owner) => isExtensionTable(owner, target))) {
          throw new Error(`The ${definition.key} repository refers to table "${target}", which is neither its own `
            + 'nor a dependency\'s.');
        }
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
      const issues = await definition.check?.(contextOf(trx), typed, changed, id) ?? [];
      if (issues.length > 0) {
        throw new EntityValidationError(issues);
      }
      try {
        await write();
        // Owned rows may have unique indexes of their own, such as a route's hostnames on its proxy.
        await definition.writeOwned?.(contextOf(trx), id, typed, changed);
      } catch (error) {
        if (definition.unique && isUniqueViolation(error)) {
          throw new EntityConflictError([...definition.unique]);
        }
        throw error;
      }
      const [saved] = await find(trx, { id });
      return saved;
    };

    const countDependents = async (trx: Kysely<Database>, id: string): Promise<Dependent[]> => {
      const dependents = definition.dependents ?? [];
      const counts = await Promise.all(dependents.map(async ({ entity, table: dependent, column }) => {
        const row = await loose(trx).selectFrom(dependent)
          .select((expression) => expression.fn.countAll().as('count'))
          .where('workspaceId', '=', scope.workspaceId)
          .where(column, '=', id)
          .executeTakeFirst();
        return { entity, count: Number(row?.count ?? 0) };
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

      get: async (id) => (isId(id) ? (await find(db, { id }))[0] : undefined),

      list: async (filter) => {
        const where = parseEntity(filterSchema, filter ?? {}) as Row;
        return find(db, pick(where, definition.filters ?? []));
      },

      update: async (id, patch) => {
        const changes = parseEntity(definition.schema.patch, patch) as Row;
        if (!isId(id)) {
          return undefined;
        }
        return inTransaction(db, async (trx) => {
          // Locks the row before reading it (a no-op write), so checks that read other tables see what committed first.
          await loose(trx).updateTable(table).set({ updatedAt: sql.ref('updatedAt') })
            .where('workspaceId', '=', scope.workspaceId)
            .where('id', '=', id)
            .execute();
          const [current] = await find(trx, { id });
          if (!current) {
            return undefined;
          }
          const fields = parseEntity(definition.schema.input, { ...pick(current, inputFields), ...changes }) as Row;
          // Against what is stored, not the patch's keys: a refine may change a field the patch did not name. An
          // unchanged kind stays valid when its extension is turned off: data is never lost to a toggle.
          const changed = new Set(inputFields.filter((key) => !isDeepStrictEqual(fields[key], current[key])));
          checkKinds(fields, changed);
          // Only the changed columns, and only if the row is still the one read: rules checked against `current` hold.
          const columns = stored.filter((column) => changed.has(column));
          const read = current.updatedAt as Date;
          // Always later than the last write, even within its millisecond, so every write moves it.
          const updatedAt = new Date(Math.max(Date.now(), read.getTime() + 1));
          return save(trx, id, fields, changed, async () => {
            const { numUpdatedRows } = await loose(trx).updateTable(table)
              .set({ ...toRow(fields, columns), updatedBy: scope.actorId, updatedAt: toTimestamp(updatedAt) })
              .where('workspaceId', '=', scope.workspaceId)
              .where('id', '=', id)
              .where('updatedAt', '=', toTimestamp(read))
              .executeTakeFirstOrThrow();
            if (numUpdatedRows === 0n) {
              throw new EntityChangedError();
            }
          });
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
