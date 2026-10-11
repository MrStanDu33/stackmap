import { createApp, toWebHandler } from 'h3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import handler from './health.get';
import { version } from '../../package.json';
import { openTestDatabase } from '../../tests/support/databases';
import { setDatabase } from '../utils/database';

import type { TestDatabase } from '../../tests/support/databases';

const get = async () => {
  const response = await toWebHandler(createApp().use('/api/health', handler))(
    new Request('http://localhost/api/health'),
  );
  return { status: response.status, json: await response.json() as unknown };
};

let database: TestDatabase | undefined;

afterEach(async () => {
  vi.restoreAllMocks();
  await database?.cleanup();
  database = undefined;
});

describe('GET /api/health', () => {
  it('given the database answers, returns 200 with status ok, the app version and database ok', async () => {
    database = await openTestDatabase('sqlite');
    setDatabase(Promise.resolve(database.db));

    expect(await get()).toEqual({ status: 200, json: { status: 'ok', version, database: 'ok' } });
  });

  it('given the database does not answer, returns 503 with status error and database error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    database = await openTestDatabase('sqlite');
    await database.db.destroy();
    setDatabase(Promise.resolve(database.db));

    expect(await get()).toEqual({ status: 503, json: { status: 'error', version, database: 'error' } });
  });

  it('given the database does not answer, logs the database error but never returns it', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    database = await openTestDatabase('sqlite');
    await database.db.destroy();
    setDatabase(Promise.resolve(database.db));

    const { json } = await get();

    expect(logged).toHaveBeenCalledWith(expect.stringMatching(/health.*destroyed/is));
    expect(JSON.stringify(json)).not.toMatch(/destroyed/i);
  });

  it('is public', () => {
    expect(handler.contract.requiredRole).toBe('public');
  });
});
