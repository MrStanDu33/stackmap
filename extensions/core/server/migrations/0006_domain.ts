import { withEntityColumns } from '@stackmap/extension-sdk/server';

import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/** Domains, unique per workspace, and their DNS records, which belong to the domain and go with it. */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await withEntityColumns(db.schema.createTable('core_domain'), 'core_domain')
      .addColumn('name', 'text', (column) => column.notNull())
      .addUniqueConstraint('core_domain_name_unique', ['workspaceId', 'name'])
      .execute();

    await withEntityColumns(db.schema.createTable('core_dnsRecord'), 'core_dnsRecord')
      .addColumn('domainId', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('type', 'text', (column) => column.notNull())
      .addColumn('value', 'text', (column) => column.notNull())
      .addColumn('view', 'text', (column) => column.notNull())
      .addColumn('proxied', 'integer', (column) => column.notNull())
      .addForeignKeyConstraint(
        'core_dnsRecord_domain_fk',
        ['workspaceId', 'domainId'],
        'core_domain',
        ['workspaceId', 'id'],
        (constraint) => constraint.onDelete('cascade'),
      )
      .execute();
    await db.schema.createIndex('core_dnsRecord_domain_idx').on('core_dnsRecord').columns(['workspaceId', 'domainId']).execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('core_dnsRecord').execute();
    await db.schema.dropTable('core_domain').execute();
  },
};
