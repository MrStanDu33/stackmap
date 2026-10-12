import { withEntityColumns } from './entity-columns';

import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/** Networks, optionally on a site of the same workspace. */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await withEntityColumns(db.schema.createTable('network'), 'network')
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('cidr', 'text')
      .addColumn('vlan', 'integer')
      .addColumn('siteId', 'text')
      .addForeignKeyConstraint('network_site_fk', ['workspaceId', 'siteId'], 'site', ['workspaceId', 'id'])
      .execute();
    await db.schema.createIndex('network_site_idx').on('network').columns(['workspaceId', 'siteId']).execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('network').execute();
  },
};
