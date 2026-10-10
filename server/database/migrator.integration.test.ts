import { NO_MIGRATIONS } from 'kysely/migration';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MIGRATIONS } from './migrations';
import { migrateTo, migrateToLatest } from './migrator';
import { describeSchema, DIALECTS, openTestDatabase } from '../../tests/support/databases';

import type { Dialect, TestDatabase } from '../../tests/support/databases';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

const NAMES = Object.keys(MIGRATIONS);

/** A migration that creates (and drops) one probe table, to test the migrator beyond the real migrations. */
const probe = (table: string): Migration => ({
  up: async (db: Kysely<unknown>) => {
    await db.schema.createTable(table).addColumn('id', 'text', (column) => column.primaryKey()).execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable(table).execute();
  },
});

describe.each(DIALECTS)('migrations on %s', (dialect: Dialect) => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = await openTestDatabase(dialect);
  });

  afterEach(async () => {
    await database.cleanup();
  });

  it('given an empty database, applies every migration in order and lists their names', async () => {
    expect(await migrateToLatest(database.db)).toEqual(NAMES);
  });

  it('given an up-to-date database, applies nothing and does not fail', async () => {
    await migrateToLatest(database.db);
    expect(await migrateToLatest(database.db)).toEqual([]);
  });

  it('given a migration that fails halfway, keeps the previous version and names the failing migration', async () => {
    await migrateToLatest(database.db);
    const before = await describeSchema(database.db, dialect);
    const failing = {
      ...MIGRATIONS,
      '9998_probe': probe('probe'),
      '9999_broken': {
        up: async (db: Kysely<unknown>) => {
          await db.schema.createTable('halfway').addColumn('id', 'text').execute();
          throw new Error('boom');
        },
      },
    };

    await expect(migrateToLatest(database.db, failing)).rejects.toThrow(/9999_broken/);
    expect(await describeSchema(database.db, dialect)).toEqual(before);
  });

  it('given a database migrated by a newer version, refuses with how to upgrade, downgrade or restore', async () => {
    await migrateToLatest(database.db, { ...MIGRATIONS, '9999_from_the_future': probe('future') });

    await expect(migrateToLatest(database.db)).rejects.toThrow(/newer.*upgrade.*migrateTo.*backup/is);
  });

  it.runIf(dialect === 'postgres')(
    'given two instances migrating the same Postgres at once, applies the migrations exactly once',
    async () => {
      const other = await database.reopen();
      const results = await Promise.all([migrateToLatest(database.db), migrateToLatest(other)]);

      expect(results.flat()).toEqual(NAMES);
    },
  );

  it('migrating down one step at a time to empty and back up gives the original schema', async () => {
    const schemas = [await describeSchema(database.db, dialect)];
    for (const name of NAMES) {
      await migrateTo(database.db, name);
      schemas.push(await describeSchema(database.db, dialect));
    }

    for (let step = NAMES.length - 1; step >= 0; step -= 1) {
      await migrateTo(database.db, NAMES[step - 1] ?? NO_MIGRATIONS);
      // Each down removes exactly what its up added.
      expect(await describeSchema(database.db, dialect)).toEqual(schemas[step]);
    }

    await migrateToLatest(database.db);
    expect(await describeSchema(database.db, dialect)).toEqual(schemas.at(-1));
  });

  it('migrateTo moves the database up or down to exactly the named migration', async () => {
    const migrations = { ...MIGRATIONS, '9001_probe_a': probe('probeA'), '9002_probe_b': probe('probeB') };

    expect(await migrateTo(database.db, '9002_probe_b', migrations)).toEqual([...NAMES, '9001_probe_a', '9002_probe_b']);
    expect(await migrateTo(database.db, '9001_probe_a', migrations)).toEqual(['9002_probe_b']);

    const tables = Object.keys(await describeSchema(database.db, dialect));
    expect(tables).toContain('probeA');
    expect(tables).not.toContain('probeB');
  });

  it('migrateTo with an unknown name fails and lists the known migrations', async () => {
    await expect(migrateTo(database.db, '0042_unknown')).rejects.toThrow(new RegExp(`0042_unknown.*${NAMES.join('.*')}`, 's'));
  });

  describe('0001_app_setting', () => {
    it('creates appSetting with key text primary key, value text not null and updatedAt text not null', async () => {
      await migrateToLatest(database.db);

      expect((await describeSchema(database.db, dialect)).appSetting).toEqual([
        { name: 'key', nullable: false, primaryKey: true },
        { name: 'updatedAt', nullable: false, primaryKey: false },
        { name: 'value', nullable: false, primaryKey: false },
      ]);
    });
  });
});

describe('migrations on both databases', () => {
  it.runIf(DIALECTS.length === 2)(
    'leaves SQLite and Postgres with the same tables and columns (names, nullability, primary keys)',
    async () => {
      const [sqlite, postgres] = await Promise.all([openTestDatabase('sqlite'), openTestDatabase('postgres')]);
      try {
        await Promise.all([migrateToLatest(sqlite.db), migrateToLatest(postgres.db)]);

        expect(await describeSchema(postgres.db, 'postgres')).toEqual(await describeSchema(sqlite.db, 'sqlite'));
      } finally {
        await Promise.all([sqlite.cleanup(), postgres.cleanup()]);
      }
    },
  );
});
