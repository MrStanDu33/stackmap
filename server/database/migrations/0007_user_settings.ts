import { sql } from 'kysely';

import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/**
 * The account's settings: a mark for a temporary password to replace (a Better Auth additional field on `user`), and
 * the person's display preferences and landing page, each null until chosen.
 */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await db.schema.alterTable('user')
      .addColumn('mustChangePassword', 'boolean', (column) => column.notNull().defaultTo(false))
      .execute();
    await db.schema
      .createTable('userPreference')
      .addColumn('userId', 'text', (column) => column.primaryKey().notNull())
      .addColumn('theme', 'text')
      .addColumn('contrast', 'text')
      .addColumn('locale', 'text')
      .addColumn('landingPage', 'text')
      .addColumn('updatedAt', 'text', (column) => column.notNull())
      .addForeignKeyConstraint('userPreference_user_fkey', ['userId'], 'user', ['id'], (key) => key.onDelete('cascade'))
      .addCheckConstraint('userPreference_theme_check', sql`theme in ('dark', 'light')`)
      .addCheckConstraint('userPreference_contrast_check', sql`contrast in ('standard', 'strict')`)
      .addCheckConstraint('userPreference_locale_check', sql`locale in ('en', 'fr')`)
      .addCheckConstraint('userPreference_landingPage_check', sql`"landingPage" in ('graph', 'trace')`)
      .execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('userPreference').execute();
    await db.schema.alterTable('user').dropColumn('mustChangePassword').execute();
  },
};
