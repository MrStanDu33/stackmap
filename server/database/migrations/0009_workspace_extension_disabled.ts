import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/**
 * The extensions turned off in each workspace. No row means on, so a newly installed extension is on everywhere; the
 * extension id has no foreign key, so a choice outlives an uninstall and reinstalling restores it.
 */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable('workspace_extension_disabled')
      .addColumn('workspaceId', 'text', (column) => column.notNull())
      .addColumn('extension', 'text', (column) => column.notNull())
      .addColumn('disabledAt', 'text', (column) => column.notNull())
      .addColumn('disabledBy', 'text')
      .addPrimaryKeyConstraint('workspace_extension_disabled_pkey', ['workspaceId', 'extension'])
      .addForeignKeyConstraint(
        'workspace_extension_disabled_workspace_fkey', ['workspaceId'], 'workspace', ['id'], (key) => key.onDelete('cascade'),
      )
      .addForeignKeyConstraint(
        'workspace_extension_disabled_user_fkey', ['disabledBy'], 'user', ['id'], (key) => key.onDelete('set null'),
      )
      .execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('workspace_extension_disabled').execute();
  },
};
