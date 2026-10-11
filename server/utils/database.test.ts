import { describe, expect, it, vi } from 'vitest';

import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

// A fresh module per test: the database is module state, set once by the startup plugin.
const loadModule = async () => {
  vi.resetModules();
  return import('./database');
};

describe('useDatabase', () => {
  it('resolves to the database prepared by the startup plugin', async () => {
    const { setDatabase, useDatabase } = await loadModule();
    const db = {} as Kysely<Database>;

    setDatabase(Promise.resolve(db));

    await expect(useDatabase()).resolves.toBe(db);
  });

  it('before the plugin ran, fails with a clear error', async () => {
    const { useDatabase } = await loadModule();

    expect(() => useDatabase()).toThrow(/not ready.*plugin/i);
  });
});
