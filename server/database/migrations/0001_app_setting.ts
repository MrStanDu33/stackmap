import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/** Instance-wide settings (registration toggle, default landing page…), one JSON value per key. */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable('appSetting')
      // SQLite allows NULL in a text primary key unless it is declared NOT NULL.
      .addColumn('key', 'text', (column) => column.primaryKey().notNull())
      .addColumn('value', 'text', (column) => column.notNull())
      .addColumn('updatedAt', 'text', (column) => column.notNull())
      .execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('appSetting').execute();
  },
};
