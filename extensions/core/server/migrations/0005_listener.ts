import { withEntityColumns } from '@stackmap/extension-sdk/server';

import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/** Ports services listen on; they belong to the service and go with it. */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await withEntityColumns(db.schema.createTable('core_listener'), 'core_listener')
      .addColumn('serviceId', 'text', (column) => column.notNull())
      .addColumn('port', 'integer', (column) => column.notNull())
      .addColumn('transport', 'text', (column) => column.notNull())
      .addColumn('protocol', 'text')
      .addColumn('bindAddress', 'text')
      .addColumn('publishedPort', 'integer')
      .addForeignKeyConstraint(
        'core_listener_service_fk',
        ['workspaceId', 'serviceId'],
        'core_service',
        ['workspaceId', 'id'],
        (constraint) => constraint.onDelete('cascade'),
      )
      .execute();
    await db.schema.createIndex('core_listener_service_idx').on('core_listener').columns(['workspaceId', 'serviceId']).execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('core_listener').execute();
  },
};
