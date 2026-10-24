import { extensionTablePrefix } from '@stackmap/extension-sdk';
import { NO_MIGRATIONS } from 'kysely/migration';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BUILTIN_EXTENSION_SERVERS, BUILTIN_EXTENSIONS } from './builtin';
import { migrateExtensions, migrateExtensionTo } from './migrations';
import { createExtensionRegistry } from './registry';
import { describeSchema, DIALECTS, openTestDatabase } from '../../tests/support/databases';
import { migrateToLatest } from '../database/migrator';

import type { Dialect, TestDatabase } from '../../tests/support/databases';

const quiet = { info: () => undefined };
const withMigrations = BUILTIN_EXTENSION_SERVERS.filter(({ migrations }) => Object.keys(migrations ?? {}).length > 0);
const registry = () => createExtensionRegistry(BUILTIN_EXTENSIONS, { servers: BUILTIN_EXTENSION_SERVERS });

describe.each(DIALECTS)('built-in extension migrations on %s', (dialect: Dialect) => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = await openTestDatabase(dialect);
    await migrateToLatest(database.db);
  });

  afterEach(async () => {
    await database.cleanup();
  });

  it('every built-in extension creates only tables that start with its prefix', async () => {
    expect(withMigrations.map(({ extension }) => extension)).toContain('core');
    const platform = Object.keys(await describeSchema(database.db, dialect));

    await migrateExtensions(database.db, registry(), quiet);

    const added = Object.keys(await describeSchema(database.db, dialect)).filter((table) => !platform.includes(table));
    const prefixes = withMigrations.map(({ extension }) => `${extensionTablePrefix(extension)}_`);
    expect(added.length).toBeGreaterThan(0);
    expect(added.filter((table) => !prefixes.some((prefix) => table.startsWith(prefix)))).toEqual([]);
  });

  it('every built-in extension\'s migrations go down one at a time to empty and back up to the same schema', async () => {
    await migrateExtensions(database.db, registry(), quiet);
    const latest = await describeSchema(database.db, dialect);

    // Dependents first on the way down, dependencies first on the way up.
    for (const server of [...withMigrations].reverse()) {
      const names = Object.keys(server.migrations ?? {});
      for (const target of [...names.slice(0, -1).reverse(), NO_MIGRATIONS]) {
        await migrateExtensionTo(database.db, server, target);
      }
    }
    await migrateExtensions(database.db, registry(), quiet);

    expect(await describeSchema(database.db, dialect)).toEqual(latest);
  });
});

describe('built-in extension migrations on both databases', () => {
  it.runIf(DIALECTS.length === 2)('SQLite and Postgres end with the same schema', async () => {
    const [sqlite, postgres] = await Promise.all([openTestDatabase('sqlite'), openTestDatabase('postgres')]);
    try {
      for (const database of [sqlite, postgres]) {
        await migrateToLatest(database.db);
        await migrateExtensions(database.db, registry(), quiet);
      }

      expect(await describeSchema(postgres.db, 'postgres')).toEqual(await describeSchema(sqlite.db, 'sqlite'));
    } finally {
      await Promise.all([sqlite.cleanup(), postgres.cleanup()]);
    }
  });
});
