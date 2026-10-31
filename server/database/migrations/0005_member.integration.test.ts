import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAccount, membersOf } from '../../../tests/support/accounts';
import { DIALECTS, openTestDatabase } from '../../../tests/support/databases';
import { createWorkspace } from '../../../tests/support/workspaces';
import { migrateTo, migrateToLatest } from '../migrator';

import type { Dialect, TestDatabase } from '../../../tests/support/databases';

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
    const ada = await createAccount(database.db, { name: 'Ada', email: 'ada@homelab.example', admin: true });
    const grace = await createAccount(database.db, { name: 'Grace', email: 'grace@homelab.example' });

    await migrateToLatest(database.db);

    for (const workspace of [home, lab]) {
      const members = await membersOf(database.db, workspace.id);
      expect(members).toEqual({ [ada.user.id]: 'owner' });
      expect(members).not.toHaveProperty(grace.user.id);
    }
  });
});
