import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MIGRATIONS } from './migrations';
import { prepareDatabase } from './startup';
import { DIALECTS, openTestDatabase } from '../../tests/support/databases';

import type { Database } from './types/schema';
import type { Dialect, TestDatabase } from '../../tests/support/databases';
import type { Kysely } from 'kysely';

describe.each(DIALECTS)('database startup on %s', (dialect: Dialect) => {
  let database: TestDatabase;
  const opened: Kysely<Database>[] = [];
  const messages: string[] = [];
  const logger = { info: (message: string) => messages.push(message) };

  beforeEach(async () => {
    database = await openTestDatabase(dialect);
    messages.length = 0;
  });

  afterEach(async () => {
    await Promise.all(opened.splice(0).map((db) => db.destroy()));
    await database.cleanup();
  });

  const envFor = () => ({
    DATABASE_URL: database.config.dialect === 'sqlite' ? ':memory:' : database.config.url,
  });

  it('applies pending migrations before the app serves requests and logs their names', async () => {
    const db = await prepareDatabase(envFor(), logger);
    opened.push(db);

    // The schema is ready as soon as prepareDatabase resolves.
    await expect(sql`select count(*) from ${sql.table('appSetting')}`.execute(db)).resolves.toBeDefined();
    expect(messages).toContain(`Applied database migrations: ${Object.keys(MIGRATIONS).join(', ')}`);
  });

  it('given a failing migration, stops the startup with the migration name in the error', async () => {
    const broken = {
      ...MIGRATIONS,
      '9999_broken': {
        up: () => Promise.reject(new Error('boom')),
      },
    };

    await expect(prepareDatabase(envFor(), logger, broken)).rejects.toThrow(/9999_broken/);
  });
});
