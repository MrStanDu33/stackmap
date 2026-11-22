import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/** What the command palette hides, as a JSON array of keys: null until chosen, which hides nothing. */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await db.schema.alterTable('userPreference').addColumn('paletteHidden', 'text').execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.alterTable('userPreference').dropColumn('paletteHidden').execute();
  },
};
