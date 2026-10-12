import { withEntityColumns } from './entity-columns';

import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/** Services, on a host of the same workspace or on none (an external API). */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await withEntityColumns(db.schema.createTable('service'), 'service')
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('hostId', 'text')
      .addColumn('image', 'text')
      .addColumn('containerName', 'text')
      .addForeignKeyConstraint('service_host_fk', ['workspaceId', 'hostId'], 'host', ['workspaceId', 'id'])
      .execute();
    await db.schema.createIndex('service_host_idx').on('service').columns(['workspaceId', 'hostId']).execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('service').execute();
  },
};
