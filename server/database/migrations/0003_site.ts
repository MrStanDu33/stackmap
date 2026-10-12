import { withEntityColumns } from './entity-columns';

import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/** Sites: a home, a datacenter, a cloud region. */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await withEntityColumns(db.schema.createTable('site'), 'site')
      .addColumn('name', 'text', (column) => column.notNull())
      .execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('site').execute();
  },
};
