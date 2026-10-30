import { withEntityColumns } from '@stackmap/extension-sdk/server';

import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/**
 * Proxy routes, which belong to their proxy service and go with it, and their hostnames. An upstream listener cannot
 * be removed while a route forwards to it.
 */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await withEntityColumns(db.schema.createTable('reverse_proxy_route'), 'reverse_proxy_route')
      .addColumn('proxyServiceId', 'text', (column) => column.notNull())
      .addColumn('upstreamListenerId', 'text', (column) => column.notNull())
      .addColumn('forceSsl', 'integer', (column) => column.notNull())
      .addColumn('websockets', 'integer', (column) => column.notNull())
      .addForeignKeyConstraint(
        'reverse_proxy_route_proxy_fk',
        ['workspaceId', 'proxyServiceId'],
        'core_service',
        ['workspaceId', 'id'],
        (constraint) => constraint.onDelete('cascade'),
      )
      // The hostnames' foreign key refers to it, so they always carry their route's proxy.
      .addUniqueConstraint('reverse_proxy_route_proxy_unique', ['workspaceId', 'id', 'proxyServiceId'])
      .addForeignKeyConstraint(
        'reverse_proxy_route_upstream_fk',
        ['workspaceId', 'upstreamListenerId'],
        'core_listener',
        ['workspaceId', 'id'],
      )
      .execute();
    await db.schema.createIndex('reverse_proxy_route_proxy_idx').on('reverse_proxy_route')
      .columns(['workspaceId', 'proxyServiceId']).execute();
    await db.schema.createIndex('reverse_proxy_route_upstream_idx').on('reverse_proxy_route')
      .columns(['workspaceId', 'upstreamListenerId']).execute();

    await db.schema
      .createTable('reverse_proxy_routeHostname')
      .addColumn('id', 'text', (column) => column.primaryKey().notNull())
      .addColumn('workspaceId', 'text', (column) => column.notNull().references('workspace.id').onDelete('cascade'))
      .addColumn('routeId', 'text', (column) => column.notNull())
      // Copied from the route, so the database keeps one route per hostname on each proxy.
      .addColumn('proxyServiceId', 'text', (column) => column.notNull())
      .addColumn('hostname', 'text', (column) => column.notNull())
      .addUniqueConstraint('reverse_proxy_routeHostname_proxy_hostname_unique', ['workspaceId', 'proxyServiceId', 'hostname'])
      .addForeignKeyConstraint(
        'reverse_proxy_routeHostname_route_fk',
        ['workspaceId', 'routeId', 'proxyServiceId'],
        'reverse_proxy_route',
        ['workspaceId', 'id', 'proxyServiceId'],
        (constraint) => constraint.onDelete('cascade').onUpdate('cascade'),
      )
      .execute();
    await db.schema.createIndex('reverse_proxy_routeHostname_route_idx').on('reverse_proxy_routeHostname')
      .columns(['workspaceId', 'routeId']).execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('reverse_proxy_routeHostname').execute();
    await db.schema.dropTable('reverse_proxy_route').execute();
  },
};
