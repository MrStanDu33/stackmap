import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { createInvitation } from './invitations';
import { addMember, setMemberRole } from './members';
import { findUser, findUserByEmail, listUsers, removeAccount, setInstanceRole } from './users';
import { createAccount, membersOf } from '../../tests/support/accounts';
import { DIALECTS } from '../../tests/support/databases';
import { createWorkspace, useTestWorkspaces } from '../../tests/support/workspaces';
import { useAuth } from '../utils/auth';

import type { Dialect } from '../../tests/support/databases';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

describe.each(DIALECTS)('users repository on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const ada = () => createAccount(db(), { name: 'Ada', email: 'ada@homelab.example', admin: true });
  const grace = () => createAccount(db(), { name: 'Grace', email: 'grace@homelab.example' });
  const alan = () => createAccount(db(), { name: 'Alan', email: 'alan@homelab.example' });
  const admins = async () => (await db().selectFrom('user').select('id').where('role', '=', 'admin').execute()).length;

  it('lists every account by name (1)', async () => {
    const { user: g } = await grace();
    const { user: a } = await ada();

    expect(await listUsers(db())).toEqual([
      { id: a.id, name: 'Ada', email: 'ada@homelab.example', role: 'admin', createdAt: expect.any(String) as unknown },
      { id: g.id, name: 'Grace', email: 'grace@homelab.example', role: 'user', createdAt: expect.any(String) as unknown },
    ]);
  });

  it('finds one account by id, or nothing (6, 7)', async () => {
    const { user: g } = await grace();

    expect(await findUser(db(), g.id)).toMatchObject({ id: g.id, name: 'Grace', role: 'user' });
    expect(await findUser(db(), 'unknown-user')).toBeUndefined();
  });

  it('finds an account by email, whatever its case (3)', async () => {
    const { user: g } = await grace();

    expect(await findUserByEmail(db(), 'Grace@HomeLab.example')).toMatchObject({ id: g.id });
    expect(await findUserByEmail(db(), 'alan@homelab.example')).toBeUndefined();
  });

  it('refuses to demote the last administrator, or the actor themselves (9, 10)', async () => {
    const { user: a } = await ada();
    const { user: g } = await grace();

    expect(await setInstanceRole(db(), a.id, 'user', { actorId: a.id })).toEqual({ code: 'cannot_demote_self' });
    expect(await setInstanceRole(db(), a.id, 'user', { actorId: g.id })).toEqual({ code: 'last_admin' });
    expect(await admins()).toBe(1);
    expect(await setInstanceRole(db(), 'unknown-user', 'admin', { actorId: a.id })).toEqual({ code: 'user_not_found' });
  });

  it('promotes and demotes (8)', async () => {
    const { user: a } = await ada();
    const { user: g } = await grace();

    expect(await setInstanceRole(db(), g.id, 'admin', { actorId: a.id })).toMatchObject({ id: g.id, role: 'admin' });
    expect(await setInstanceRole(db(), g.id, 'user', { actorId: a.id })).toMatchObject({ id: g.id, role: 'user' });
  });

  it('given two concurrent demotions of the last two administrators, leaves one administrator (10)', async () => {
    const { user: a } = await ada();
    const { user: g } = await createAccount(db(), { name: 'Grace', email: 'grace@homelab.example', admin: true });

    const results = await Promise.all([
      setInstanceRole(db(), a.id, 'user', { actorId: g.id }),
      setInstanceRole(db(), g.id, 'user', { actorId: a.id }),
    ]);

    expect(results.filter((result) => 'code' in result)).toEqual([{ code: 'last_admin' }]);
    expect(await admins()).toBe(1);
  });

  it('refuses to remove the actor, or the only owner of workspaces, naming them (13, 14)', async () => {
    const { user: a } = await ada();
    const { user: g } = await grace();
    await addMember(db(), { workspaceId: workspaces.a.workspace.id, userId: g.id, role: 'owner' });
    await addMember(db(), { workspaceId: workspaces.b.workspace.id, userId: g.id, role: 'owner' });

    expect(await removeAccount(db(), a.id, { actorId: a.id })).toEqual({ code: 'cannot_remove_self' });
    expect(await removeAccount(db(), g.id, { actorId: a.id })).toEqual({
      code: 'last_owner',
      workspaces: [workspaces.a.workspace.name, workspaces.b.workspace.name].toSorted(),
    });
    expect(await membersOf(db(), workspaces.a.workspace.id)).toEqual({ [g.id]: 'owner' });
    expect(await removeAccount(db(), 'unknown-user', { actorId: a.id })).toEqual({ code: 'user_not_found' });
  });

  it('removes an owner when the workspace has a second owner (14)', async () => {
    const { user: a } = await ada();
    const { user: g } = await grace();
    const workspaceId = workspaces.a.workspace.id;
    await addMember(db(), { workspaceId, userId: g.id, role: 'owner' });
    await addMember(db(), { workspaceId, userId: a.id, role: 'owner' });

    expect(await removeAccount(db(), g.id, { actorId: a.id })).toMatchObject({ id: g.id });
    expect(await membersOf(db(), workspaceId)).toEqual({ [a.id]: 'owner' });
  });

  it('given a concurrent removal and demotion of the last two owners, leaves the workspace an owner (14)', async () => {
    const { user: a } = await ada();
    const { user: g } = await grace();
    const { user: l } = await alan();
    const workspaceId = workspaces.a.workspace.id;
    await addMember(db(), { workspaceId, userId: g.id, role: 'owner' });
    await addMember(db(), { workspaceId, userId: l.id, role: 'owner' });

    await Promise.all([
      removeAccount(db(), g.id, { actorId: a.id }),
      setMemberRole(db(), workspaceId, l.id, 'editor'),
    ]);

    expect(Object.values(await membersOf(db(), workspaceId))).toContain('owner');
  });

  it.runIf(dialect === 'postgres')(
    'waits for a change in progress in any workspace the account is in, not only those it owns (14, review)',
    async () => {
      const { user: a } = await ada();
      const { user: g } = await grace();
      const workspaceId = workspaces.a.workspace.id;
      await addMember(db(), { workspaceId, userId: g.id, role: 'editor' });
      let release = () => {};
      let locked = () => {};
      const isLocked = new Promise<void>((resolve) => {
        locked = resolve;
      });
      // A member change holding the workspace's lock, as one promoting Grace to owner would.
      const change = db().transaction().execute(async (trx) => {
        await trx.updateTable('workspace').set((update) => ({ id: update.ref('id') })).where('id', '=', workspaceId).execute();
        locked();
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      });
      await isLocked;

      let settled = false;
      const removal = removeAccount(db(), g.id, { actorId: a.id }).finally(() => {
        settled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      const waited = !settled;
      release();
      await change;
      await removal;

      expect(waited).toBe(true);
    },
  );

  it('names at most 100 sole-owned workspaces, so the refusal fits its contract (14, review)', async () => {
    const { user: a } = await ada();
    const { user: g } = await grace();
    for (let n = 0; n < 101; n += 1) {
      const { id } = await createWorkspace(db(), { name: `Lab ${String(n).padStart(3, '0')}`, slug: `lab-${String(n)}` });
      await addMember(db(), { workspaceId: id, userId: g.id, role: 'owner' });
    }

    const refused = await removeAccount(db(), g.id, { actorId: a.id });

    expect(refused).toMatchObject({ code: 'last_owner' });
    expect((refused as { workspaces: string[] }).workspaces).toHaveLength(100);
  });

  it('takes the account\'s sessions, credentials and memberships with it, and clears its invitations\' inviter (12)', async () => {
    const { user: a } = await ada();
    const { user: g } = await grace();
    const workspaceId = workspaces.a.workspace.id;
    await addMember(db(), { workspaceId, userId: g.id, role: 'admin' });
    await addMember(db(), { workspaceId, userId: a.id, role: 'owner' });
    const { invitation } = await createInvitation(db(), { workspaceId, email: 'alan@homelab.example', role: 'viewer', invitedById: g.id });
    await (await useAuth()).api.signInEmail({ body: { email: 'grace@homelab.example', password: 'correct horse battery' } });

    expect(await removeAccount(db(), g.id, { actorId: a.id })).toMatchObject({ id: g.id });

    // Better Auth's tables are not in the app's Database type.
    const left = async (table: 'session' | 'account' | 'member') => Number((await sql<{ n: number | string }>`
      select count(*) as n from ${sql.table(table)} where ${sql.ref('userId')} = ${g.id}`.execute(db())).rows[0]?.n);
    expect([await left('session'), await left('account'), await left('member')]).toEqual([0, 0, 0]);
    expect(await db().selectFrom('invitation').select('invitedById').where('id', '=', invitation.id).executeTakeFirst())
      .toEqual({ invitedById: null });
  });
});
