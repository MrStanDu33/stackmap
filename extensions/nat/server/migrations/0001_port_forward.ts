import { withEntityColumns } from '@stackmap/extension-sdk/server';

import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/** Port forwards; they belong to their host and go with it. A host forwards a port of an address once. */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await withEntityColumns(db.schema.createTable('nat_portForward'), 'nat_portForward')
      .addColumn('hostId', 'text', (column) => column.notNull())
      .addColumn('externalAddress', 'text', (column) => column.notNull())
      .addColumn('externalPort', 'integer', (column) => column.notNull())
      .addColumn('transport', 'text', (column) => column.notNull())
      .addColumn('internalAddress', 'text', (column) => column.notNull())
      .addColumn('internalPort', 'integer', (column) => column.notNull())
      .addColumn('description', 'text')
      .addForeignKeyConstraint(
        'nat_portForward_host_fk',
        ['workspaceId', 'hostId'],
        'core_host',
        ['workspaceId', 'id'],
        (constraint) => constraint.onDelete('cascade'),
      )
      .execute();
    await db.schema.createIndex('nat_portForward_external_unique').on('nat_portForward').unique()
      .columns(['workspaceId', 'hostId', 'externalAddress', 'externalPort', 'transport'])
      .execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('nat_portForward').execute();
  },
};
