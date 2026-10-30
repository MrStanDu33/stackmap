import { withEntityColumns } from '@stackmap/extension-sdk/server';

import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/**
 * Flows documented by hand. Removing their source service or target listener is refused while they exist (the
 * repository counts them), so the foreign keys restrict rather than cascade.
 */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await withEntityColumns(db.schema.createTable('core_flow'), 'core_flow')
      .addColumn('sourceServiceId', 'text', (column) => column.notNull())
      .addColumn('targetListenerId', 'text', (column) => column.notNull())
      .addColumn('protocol', 'text')
      .addColumn('purpose', 'text')
      .addColumn('encrypted', 'integer')
      .addForeignKeyConstraint('core_flow_source_fk', ['workspaceId', 'sourceServiceId'], 'core_service', ['workspaceId', 'id'])
      .addForeignKeyConstraint('core_flow_target_fk', ['workspaceId', 'targetListenerId'], 'core_listener', ['workspaceId', 'id'])
      .execute();
    await db.schema.createIndex('core_flow_source_idx').on('core_flow').columns(['workspaceId', 'sourceServiceId']).execute();
    await db.schema.createIndex('core_flow_target_idx').on('core_flow').columns(['workspaceId', 'targetListenerId']).execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('core_flow').execute();
  },
};
