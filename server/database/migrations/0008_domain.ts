import { withEntityColumns } from './entity-columns';

import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/** Domains, unique per workspace, and their DNS records, which belong to the domain and go with it. */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await withEntityColumns(db.schema.createTable('domain'), 'domain')
      .addColumn('name', 'text', (column) => column.notNull())
      .addUniqueConstraint('domain_name_unique', ['workspaceId', 'name'])
      .execute();

    await withEntityColumns(db.schema.createTable('dnsRecord'), 'dnsRecord')
      .addColumn('domainId', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('type', 'text', (column) => column.notNull())
      .addColumn('value', 'text', (column) => column.notNull())
      .addColumn('view', 'text', (column) => column.notNull())
      .addColumn('proxied', 'integer', (column) => column.notNull())
      .addForeignKeyConstraint(
        'dnsRecord_domain_fk',
        ['workspaceId', 'domainId'],
        'domain',
        ['workspaceId', 'id'],
        (constraint) => constraint.onDelete('cascade'),
      )
      .execute();
    await db.schema.createIndex('dnsRecord_domain_idx').on('dnsRecord').columns(['workspaceId', 'domainId']).execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('dnsRecord').execute();
    await db.schema.dropTable('domain').execute();
  },
};
