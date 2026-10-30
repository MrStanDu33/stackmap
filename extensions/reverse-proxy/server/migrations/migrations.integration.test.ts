import { NO_MIGRATIONS } from 'kysely/migration';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { migrateToLatest } from '../../../../server/database/migrator';
import { BUILTIN_EXTENSION_SERVERS, BUILTIN_EXTENSIONS } from '../../../../server/extensions/builtin';
import { migrateExtensions, migrateExtensionTo } from '../../../../server/extensions/migrations';
import { createExtensionRegistry } from '../../../../server/extensions/registry';
import { describeSchema, DIALECTS, openTestDatabase } from '../../../../tests/support/databases';

import type { Dialect, TestDatabase } from '../../../../tests/support/databases';

const quiet = { info: () => undefined };
const TABLES = ['reverse_proxy_route', 'reverse_proxy_routeHostname'];

describe.each(DIALECTS)('reverse proxy migrations on %s', (dialect: Dialect) => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = await openTestDatabase(dialect);
    await migrateToLatest(database.db);
  });

  afterEach(async () => {
    await database.cleanup();
  });

  it('create reverse_proxy_route and reverse_proxy_routeHostname in their own history, and drop them on rollback', async () => {
    const tables = async () => Object.keys(await describeSchema(database.db, dialect));
    const registry = createExtensionRegistry(BUILTIN_EXTENSIONS, { servers: BUILTIN_EXTENSION_SERVERS });
    await migrateExtensions(database.db, registry, quiet);

    expect(await tables()).toEqual(expect.arrayContaining(TABLES));
    expect((await database.db.introspection.getTables({ withInternalKyselyTables: true })).map(({ name }) => name))
      .toContain('kysely_migration__reverse_proxy');

    const server = BUILTIN_EXTENSION_SERVERS.find(({ extension }) => extension === 'reverse-proxy');
    expect(server).toBeDefined();
    await migrateExtensionTo(database.db, server!, NO_MIGRATIONS);

    expect((await tables()).filter((table) => TABLES.includes(table))).toEqual([]);
  });
});
