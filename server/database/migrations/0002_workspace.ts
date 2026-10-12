import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/** Workspaces: every entity belongs to one. Better Auth's organization model is mapped onto this table later. */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable('workspace')
      .addColumn('id', 'text', (column) => column.primaryKey().notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('slug', 'text', (column) => column.notNull().unique())
      .addColumn('createdAt', 'text', (column) => column.notNull())
      .addColumn('updatedAt', 'text', (column) => column.notNull())
      .execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('workspace').execute();
  },
};
