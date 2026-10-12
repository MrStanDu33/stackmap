import { defineExtensionServer } from '@stackmap/extension-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { migrateExtensions } from './migrations';
import { createExtensionRegistry, ExtensionRegistryError } from './registry';
import { describeSchema, DIALECTS, openTestDatabase } from '../../tests/support/databases';
import { migrateToLatest } from '../database/migrator';

import type { Dialect, TestDatabase } from '../../tests/support/databases';
import type { ExtensionManifest, ExtensionServer } from '@stackmap/extension-sdk';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

const manifest = (id: string, { alwaysOn = false, dependsOn = [] as string[] } = {}): ExtensionManifest => ({
  id,
  version: '1.0.0',
  apiVersion: 1,
  name: `extensions.${id}.name`,
  description: `extensions.${id}.description`,
  alwaysOn,
  dependsOn,
  code: { server: true },
  contributes: { kinds: {} },
});

/** Creates (and drops) a table, referencing another one when given. */
const createTable = (table: string, references?: string): Migration => ({
  up: async (db: Kysely<unknown>) => {
    await db.schema.createTable(table)
      .addColumn('id', 'text', (column) => column.primaryKey().notNull())
      .addColumn('parentId', 'text', (column) => (references ? column.references(`${references}.id`) : column))
      .execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable(table).execute();
  },
});

const failing: Migration = {
  up: async (db: Kysely<unknown>) => {
    await db.schema.createTable('zeta_halfway').addColumn('id', 'text').execute();
    throw new Error('boom');
  },
};

const logger = () => {
  const lines: string[] = [];
  return { lines, info: (line: string) => void lines.push(line) };
};

const tablesOf = async (database: TestDatabase, dialect: Dialect) =>
  Object.keys(await describeSchema(database.db, dialect));

describe.each(DIALECTS)('extension migrations on %s', (dialect: Dialect) => {
  let database: TestDatabase;
  // `aaa` depends on `zeta`: the registry runs zeta first although it sorts after.
  const zeta = manifest('zeta');
  const aaa = manifest('aaa', { dependsOn: ['zeta'] });

  const registryOf = (servers: ExtensionServer[], manifests = [aaa, zeta]) =>
    createExtensionRegistry(manifests, { servers });
  const zetaServer = (migrations: Record<string, Migration>) => defineExtensionServer(zeta, { migrations });
  const aaaServer = defineExtensionServer(aaa, { migrations: { '0001_item': createTable('aaa_item', 'zeta_thing') } });

  beforeEach(async () => {
    database = await openTestDatabase(dialect);
    await migrateToLatest(database.db);
  });

  afterEach(async () => {
    await database.cleanup();
  });

  it('runs each active extension\'s migrations after the app\'s, in registry order, each in its own history', async () => {
    const registry = registryOf([aaaServer, zetaServer({ '0001_thing': createTable('zeta_thing') })]);

    await migrateExtensions(database.db, registry, logger());

    expect(await tablesOf(database, dialect)).toEqual(expect.arrayContaining(['zeta_thing', 'aaa_item']));
    const histories = await database.db.introspection.getTables({ withInternalKyselyTables: true });
    const names = histories.map(({ name }) => name);
    expect(names).toEqual(expect.arrayContaining(['kysely_migration', 'kysely_migration_zeta', 'kysely_migration_aaa']));
    expect(registry.extensions.map(({ manifest: { id }, state }) => `${id} ${state}`)).toEqual(['zeta active', 'aaa active']);
  });

  it('logs the applied migrations per extension', async () => {
    const log = logger();

    await migrateExtensions(database.db, registryOf([aaaServer, zetaServer({ '0001_thing': createTable('zeta_thing') })]), log);

    expect(log.lines).toEqual([
      '[extension:zeta] Applied database migrations: 0001_thing',
      '[extension:aaa] Applied database migrations: 0001_item',
    ]);
  });

  it('given an up-to-date database, applies nothing', async () => {
    const servers = [aaaServer, zetaServer({ '0001_thing': createTable('zeta_thing') })];
    await migrateExtensions(database.db, registryOf(servers), logger());
    const log = logger();

    await migrateExtensions(database.db, registryOf(servers), log);

    expect(log.lines).toEqual([
      '[extension:zeta] Database tables are up to date',
      '[extension:aaa] Database tables are up to date',
    ]);
  });

  it('given a failing migration of a non-core extension, rolls it back and fails the extension and its dependents, with the error', async () => {
    const registry = registryOf([aaaServer, zetaServer({ '0001_thing': createTable('zeta_thing'), '0002_broken': failing })]);

    await migrateExtensions(database.db, registry, logger());

    expect(registry.get('zeta')).toMatchObject({ state: 'failed', errors: [expect.stringMatching(/0002_broken.*boom/)] });
    expect(registry.get('aaa')).toMatchObject({ state: 'failed', errors: ['needs "zeta", which failed'] });
    expect(await tablesOf(database, dialect)).not.toContain('zeta_halfway');
    expect(await tablesOf(database, dialect)).not.toContain('aaa_item');
  });

  it('given a failing migration of the core, stops with the error', async () => {
    const core = manifest('core', { alwaysOn: true });
    const registry = createExtensionRegistry([core], {
      servers: [defineExtensionServer(core, { migrations: { '0001_broken': failing } })],
    });

    await expect(migrateExtensions(database.db, registry, logger())).rejects.toThrow(ExtensionRegistryError);
  });

  it('given a database migrated by a newer version of an extension, fails that extension with the upgrade or downgrade message', async () => {
    await migrateExtensions(database.db, registryOf([aaaServer, zetaServer({
      '0001_thing': createTable('zeta_thing'),
      '0002_more': createTable('zeta_more'),
    })]), logger());
    const older = registryOf([aaaServer, zetaServer({ '0001_thing': createTable('zeta_thing') })]);

    await migrateExtensions(database.db, older, logger());

    expect(older.get('zeta')).toMatchObject({ state: 'failed', errors: [expect.stringMatching(/newer version.*0002_more.*migrateTo/s)] });
  });
});
