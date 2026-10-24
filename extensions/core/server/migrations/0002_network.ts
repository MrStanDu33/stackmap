import { withEntityColumns } from '@stackmap/extension-sdk/server';

import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/** Networks, optionally on a site of the same workspace. */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await withEntityColumns(db.schema.createTable('core_network'), 'core_network')
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('cidr', 'text')
      .addColumn('vlan', 'integer')
      .addColumn('siteId', 'text')
      .addForeignKeyConstraint('core_network_site_fk', ['workspaceId', 'siteId'], 'core_site', ['workspaceId', 'id'])
      .execute();
    await db.schema.createIndex('core_network_site_idx').on('core_network').columns(['workspaceId', 'siteId']).execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('core_network').execute();
  },
};
