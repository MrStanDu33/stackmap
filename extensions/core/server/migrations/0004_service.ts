import { withEntityColumns } from '@stackmap/extension-sdk/server';

import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/** Services, on a host of the same workspace or on none (an external API). */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await withEntityColumns(db.schema.createTable('core_service'), 'core_service')
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('hostId', 'text')
      .addColumn('image', 'text')
      .addColumn('containerName', 'text')
      .addForeignKeyConstraint('core_service_host_fk', ['workspaceId', 'hostId'], 'core_host', ['workspaceId', 'id'])
      .execute();
    await db.schema.createIndex('core_service_host_idx').on('core_service').columns(['workspaceId', 'hostId']).execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('core_service').execute();
  },
};
