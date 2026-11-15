import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/**
 * The hidden entities of turned-off extensions that admins chose to keep hidden: they leave the list of entities that
 * connect to nothing. The entity has no foreign key, its table depends on its type; a mark for one that is gone is
 * ignored, and an extension's marks are cleared when it is turned back on.
 */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable('workspace_hidden_entity_kept')
      .addColumn('workspaceId', 'text', (column) => column.notNull())
      .addColumn('extension', 'text', (column) => column.notNull())
      .addColumn('entity', 'text', (column) => column.notNull())
      .addColumn('entityId', 'text', (column) => column.notNull())
      .addColumn('keptAt', 'text', (column) => column.notNull())
      .addColumn('keptBy', 'text')
      .addPrimaryKeyConstraint('workspace_hidden_entity_kept_pkey', ['workspaceId', 'extension', 'entity', 'entityId'])
      .addForeignKeyConstraint(
        'workspace_hidden_entity_kept_workspace_fkey', ['workspaceId'], 'workspace', ['id'], (key) => key.onDelete('cascade'),
      )
      .addForeignKeyConstraint(
        'workspace_hidden_entity_kept_user_fkey', ['keptBy'], 'user', ['id'], (key) => key.onDelete('set null'),
      )
      .execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('workspace_hidden_entity_kept').execute();
  },
};
