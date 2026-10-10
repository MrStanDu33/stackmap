import { chmodSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { sql } from 'kysely';
import { afterEach, describe, expect, it } from 'vitest';

import { connectDatabase } from './connection';
import { DIALECTS } from '../../tests/support/databases';

import type { Database } from './types/schema';
import type { Kysely } from 'kysely';

const opened: Kysely<Database>[] = [];
const directories: string[] = [];

const temporaryDirectory = () => {
  const directory = mkdtempSync(join(tmpdir(), 'stackmap-db-'));
  directories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(opened.splice(0).map((db) => db.destroy()));
  for (const directory of directories.splice(0)) {
    chmodSync(directory, 0o700);
    rmSync(directory, { recursive: true, force: true });
  }
});

const pragma = async (db: Kysely<Database>, name: string) => {
  const { rows } = await sql<Record<string, unknown>>`select * from ${sql.raw(`pragma_${name}`)}`.execute(db);
  return Object.values(rows[0] ?? {})[0];
};

describe('database connection', () => {
  describe('SQLite', () => {
    it('creates a missing directory and opens the file with foreign keys, WAL journal mode and a busy timeout', async () => {
      const path = join(temporaryDirectory(), 'nested', 'deeper', 'stackmap.sqlite');
      const db = await connectDatabase({ dialect: 'sqlite', path });
      opened.push(db);

      expect(existsSync(path)).toBe(true);
      expect(await pragma(db, 'foreign_keys')).toBe(1);
      expect(await pragma(db, 'journal_mode')).toBe('wal');
      expect(await pragma(db, 'busy_timeout')).toBeGreaterThanOrEqual(1000);
    });

    // Root ignores file permissions, so the check only means something for a regular user.
    it.skipIf(process.getuid?.() === 0)(
      'given a directory that is not writable, fails with an error naming the path and hinting at PUID/PGID',
      async () => {
        const directory = temporaryDirectory();
        chmodSync(directory, 0o500);
        const path = join(directory, 'stackmap.sqlite');

        await expect(connectDatabase({ dialect: 'sqlite', path })).rejects.toThrow(
          expect.objectContaining({ message: expect.stringMatching(new RegExp(`${path}.*PUID`, 's')) as string }),
        );
      },
    );
  });

  describe('Postgres', () => {
    it.runIf(DIALECTS.includes('postgres'))('runs queries through a connection pool', async () => {
      const { openTestDatabase } = await import('../../tests/support/databases');
      const database = await openTestDatabase('postgres');
      try {
        // Five half-second queries finish together only if they run on several pooled connections.
        const started = performance.now();
        await Promise.all(Array.from({ length: 5 }, () => sql`select pg_sleep(0.5)`.execute(database.db)));
        expect(performance.now() - started).toBeLessThan(2000);
      } finally {
        await database.cleanup();
      }
    });

    it('given an unreachable server, fails with an error naming the host and port but not the password', async () => {
      const connecting = connectDatabase({ dialect: 'postgres', url: 'postgres://stackmap:hunter2@127.0.0.1:1/stackmap' });

      await expect(connecting).rejects.toThrow(/127\.0\.0\.1:1/);
      await expect(connecting).rejects.toThrow(
        expect.objectContaining({ message: expect.not.stringContaining('hunter2') as string }),
      );
    });
  });
});
