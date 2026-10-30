import type { EntityIssue, EntitySchema } from './entities';
import type { KindEntity } from './manifest';
import type { CreateTableBuilder, Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/*
 * What an extension's server code uses to contribute entities: its migrations and repository definitions. The server
 * builds the repositories from the definitions and enforces workspace isolation; extensions only describe their data.
 */

export type { Migration };

/** Tells which kinds the active extensions provide. */
export interface KindCatalog {
  hasKind: (entity: KindEntity, id: string) => boolean;
}

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

/**
 * The repositories of the active extensions, by key. An extension adds its own by augmenting this interface:
 * `declare module '@stackmap/extension-sdk/server' { interface EntityRepositories { hosts: … } }`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- filled by declaration merging.
export interface EntityRepositories {}

/** The connection (or transaction) a definition's callbacks use, and the scope they must filter by. */
export interface RepositoryContext<DB = unknown> {
  db: Kysely<DB>;
  scope: RepositoryScope;
  /** A new id, for rows an entity owns: UUIDv7, like every id. */
  newId: () => string;
}

/** A field that refers to another entity, which must be in the same workspace. */
export interface EntityReference {
  /** Dotted path of the field: `siteId`, `addresses.1.networkId`. */
  field: string;
  table: string;
  id: string;
}

type Row = Record<string, unknown>;

/** How an entity is stored, checked and completed; the server builds its repository from it. */
export interface EntityRepositoryDefinition<Fields = unknown, Input = unknown, DB = unknown> {
  /** The entity's id in the extension's manifest. */
  entity: string;
  /** Its property in `EntityRepositories`: unique across extensions. */
  key: string;
  /** The table the manifest declares for the entity. */
  table: string;
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
  references?(fields: Fields): EntityReference[];
  /** Rows of other tables that refer to this entity and prevent removing it; `entity` names them in the error. */
  dependents?: readonly { entity: string; table: string; column: string }[];
  /** Entities of its dependencies whose removal this entity's rows prevent, through `column` of its own table. */
  dependentsOf?: readonly { entity: string; column: string }[];
  /** Checks that need the database, on the changed fields; `id` is the entity's, new on create. */
  check?(
    context: RepositoryContext<DB>, fields: Fields, changed: ReadonlySet<string>, id: string,
  ): Promise<EntityIssue[]>;
  /** Writes the rows the entity owns, when their fields changed. */
  writeOwned?(context: RepositoryContext<DB>, id: string, fields: Fields, changed: ReadonlySet<string>): Promise<void>;
  /** Adds owned and derived fields to entities read from the table. */
  expand?(context: RepositoryContext<DB>, entities: Row[]): Promise<Row[]>;
}

/** Types a repository definition; the server checks it against the manifest and builds the repository. */
export function defineEntityRepository<Fields, Input, DB = unknown>(
  definition: EntityRepositoryDefinition<Fields, Input, DB>,
): EntityRepositoryDefinition<Fields, Input, DB> {
  return definition;
}

/**
 * Adds the common entity columns, a `workspaceId` referencing the workspace, and `unique (workspaceId, id)`, which
 * composite foreign keys point to so that a row can only refer to a row of its own workspace. A migration that used
 * it keeps these columns: a later change to them goes in a new migration, never here.
 */
export function withEntityColumns<T extends string>(
  table: CreateTableBuilder<T>,
  name: string,
): CreateTableBuilder<T, string> {
  return table
    // SQLite allows NULL in a text primary key unless it is declared NOT NULL.
    .addColumn('id', 'text', (column) => column.primaryKey().notNull())
    .addColumn('workspaceId', 'text', (column) => column.notNull().references('workspace.id').onDelete('cascade'))
    .addColumn('status', 'text', (column) => column.notNull())
    .addColumn('tags', 'text', (column) => column.notNull())
    .addColumn('notes', 'text', (column) => column.notNull())
    .addColumn('links', 'text', (column) => column.notNull())
    .addColumn('customFields', 'text', (column) => column.notNull())
    .addColumn('origin', 'text', (column) => column.notNull())
    .addColumn('externalRef', 'text')
    .addColumn('createdBy', 'text')
    .addColumn('updatedBy', 'text')
    .addColumn('createdAt', 'text', (column) => column.notNull())
    .addColumn('updatedAt', 'text', (column) => column.notNull())
    .addUniqueConstraint(`${name}_workspace_id_unique`, ['workspaceId', 'id']);
}
