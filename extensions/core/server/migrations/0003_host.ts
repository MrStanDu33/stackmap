import { withEntityColumns } from '@stackmap/extension-sdk/server';

import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/** Hosts, optionally on a site, and their IP addresses, which belong to the host and go with it. */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await withEntityColumns(db.schema.createTable('core_host'), 'core_host')
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('os', 'text')
      .addColumn('siteId', 'text')
      .addForeignKeyConstraint('core_host_site_fk', ['workspaceId', 'siteId'], 'core_site', ['workspaceId', 'id'])
      .execute();
    await db.schema.createIndex('core_host_site_idx').on('core_host').columns(['workspaceId', 'siteId']).execute();

    await db.schema
      .createTable('core_hostAddress')
      .addColumn('id', 'text', (column) => column.primaryKey().notNull())
      .addColumn('workspaceId', 'text', (column) => column.notNull().references('workspace.id').onDelete('cascade'))
      .addColumn('hostId', 'text', (column) => column.notNull())
      .addColumn('networkId', 'text')
      .addColumn('address', 'text', (column) => column.notNull())
      .addUniqueConstraint('core_hostAddress_host_address_unique', ['hostId', 'address'])
      .addForeignKeyConstraint(
        'core_hostAddress_host_fk',
        ['workspaceId', 'hostId'],
        'core_host',
        ['workspaceId', 'id'],
        (constraint) => constraint.onDelete('cascade'),
      )
      .addForeignKeyConstraint('core_hostAddress_network_fk', ['workspaceId', 'networkId'], 'core_network', ['workspaceId', 'id'])
      .execute();
    await db.schema.createIndex('core_hostAddress_network_idx').on('core_hostAddress').columns(['workspaceId', 'networkId']).execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('core_hostAddress').execute();
    await db.schema.dropTable('core_host').execute();
  },
};
