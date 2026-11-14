import { randomUUID } from 'node:crypto';

import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { membersOf } from '../../../tests/support/accounts';
import { DIALECTS, openTestDatabase } from '../../../tests/support/databases';
import { createWorkspace } from '../../../tests/support/workspaces';
import { migrateTo, migrateToLatest } from '../migrator';

import type { Dialect, TestDatabase } from '../../../tests/support/databases';
import type { Database } from '../types/schema';
import type { Kysely } from 'kysely';

/**
 * A user row as Better Auth stores one, written directly: at 0004 the schema is older than the one Better Auth now
 * expects (0007 adds a column). Answers its id.
 */
async function insertUser(db: Kysely<Database>, { name, email, role }: { name: string; email: string; role: string }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  await sql`insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role)
    values (${id}, ${name}, ${email}, ${sql.lit(false)}, ${now}, ${now}, ${role})`.execute(db);
  return id;
}

describe.each(DIALECTS)('migration 0005_member on %s', (dialect: Dialect) => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = await openTestDatabase(dialect);
  });
  afterEach(async () => {
    await database.cleanup();
  });

  it('makes each instance administrator owner of each existing workspace, and nobody else a member (1)', async () => {
    await migrateTo(database.db, '0004_auth');
    const home = await createWorkspace(database.db, { name: 'Home', slug: 'home' });
    const lab = await createWorkspace(database.db, { name: 'Lab', slug: 'lab' });
    const ada = await insertUser(database.db, { name: 'Ada', email: 'ada@homelab.example', role: 'admin' });
    const grace = await insertUser(database.db, { name: 'Grace', email: 'grace@homelab.example', role: 'user' });

    await migrateToLatest(database.db);

    for (const workspace of [home, lab]) {
      const members = await membersOf(database.db, workspace.id);
      expect(members).toEqual({ [ada]: 'owner' });
      expect(members).not.toHaveProperty(grace);
    }
  });
});
