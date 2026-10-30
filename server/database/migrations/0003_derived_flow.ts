import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/**
 * Flows the extensions' derivers produce, rewritten after every write. No foreign keys to the services and listeners:
 * they are extension tables, created after the app's migrations; the refresh, in the write's transaction, drops the
 * flows of what was removed.
 */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable('derived_flow')
      .addColumn('id', 'text', (column) => column.primaryKey().notNull())
      .addColumn('workspaceId', 'text', (column) => column.notNull().references('workspace.id').onDelete('cascade'))
      .addColumn('extension', 'text', (column) => column.notNull())
      .addColumn('deriver', 'text', (column) => column.notNull())
      .addColumn('key', 'text', (column) => column.notNull())
      .addColumn('sourceServiceId', 'text')
      .addColumn('sourceClient', 'text')
      .addColumn('targetListenerId', 'text', (column) => column.notNull())
      .addColumn('protocol', 'text')
      .addColumn('encrypted', 'integer')
      .addColumn('hostnames', 'text', (column) => column.notNull())
      .addColumn('basis', 'text', (column) => column.notNull())
      .addUniqueConstraint('derived_flow_key_unique', ['workspaceId', 'extension', 'deriver', 'key'])
      .execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('derived_flow').execute();
  },
};
