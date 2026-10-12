import { withEntityColumns } from './entity-columns';

import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/** Hosts, optionally on a site, and their IP addresses, which belong to the host and go with it. */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await withEntityColumns(db.schema.createTable('host'), 'host')
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('os', 'text')
      .addColumn('siteId', 'text')
      .addForeignKeyConstraint('host_site_fk', ['workspaceId', 'siteId'], 'site', ['workspaceId', 'id'])
      .execute();
    await db.schema.createIndex('host_site_idx').on('host').columns(['workspaceId', 'siteId']).execute();

    await db.schema
      .createTable('hostAddress')
      .addColumn('id', 'text', (column) => column.primaryKey().notNull())
      .addColumn('workspaceId', 'text', (column) => column.notNull().references('workspace.id').onDelete('cascade'))
      .addColumn('hostId', 'text', (column) => column.notNull())
      .addColumn('networkId', 'text')
      .addColumn('address', 'text', (column) => column.notNull())
      .addUniqueConstraint('hostAddress_host_address_unique', ['hostId', 'address'])
      .addForeignKeyConstraint(
        'hostAddress_host_fk',
        ['workspaceId', 'hostId'],
        'host',
        ['workspaceId', 'id'],
        (constraint) => constraint.onDelete('cascade'),
      )
      .addForeignKeyConstraint('hostAddress_network_fk', ['workspaceId', 'networkId'], 'network', ['workspaceId', 'id'])
      .execute();
    await db.schema.createIndex('hostAddress_network_idx').on('hostAddress').columns(['workspaceId', 'networkId']).execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('hostAddress').execute();
    await db.schema.dropTable('host').execute();
  },
};
