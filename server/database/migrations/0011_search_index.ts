import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/**
 * What names each entity, for search: its title as stored and the normalized text of its search fields and tags,
 * matched with LIKE on both databases. No foreign key to the entity, whose table depends on its type: the repositories
 * write it in the entity's transaction, and a row whose entity is gone (a cascade) is skipped and deleted when found.
 */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable('search_index')
      .addColumn('workspaceId', 'text', (column) => column.notNull())
      .addColumn('extension', 'text', (column) => column.notNull())
      .addColumn('entity', 'text', (column) => column.notNull())
      .addColumn('entityId', 'text', (column) => column.notNull())
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('text', 'text', (column) => column.notNull())
      .addPrimaryKeyConstraint('search_index_pkey', ['workspaceId', 'extension', 'entity', 'entityId'])
      .addForeignKeyConstraint(
        'search_index_workspace_fkey', ['workspaceId'], 'workspace', ['id'], (key) => key.onDelete('cascade'),
      )
      .execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('search_index').execute();
  },
};
