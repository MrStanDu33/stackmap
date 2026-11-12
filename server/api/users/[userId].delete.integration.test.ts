import { describe, expect, it } from 'vitest';

import { createAccount, membersOf, useTestAccounts } from '../../../tests/support/accounts';
import { DIALECTS } from '../../../tests/support/databases';
import { createInvitation } from '../../repositories/invitations';
import { addMember } from '../../repositories/members';

import type { Dialect } from '../../../tests/support/databases';

describe.each(DIALECTS)('DELETE /api/users/:userId on %s', (dialect: Dialect) => {
  const accounts = useTestAccounts(dialect);
  const grace = () => createAccount(accounts.db(), { name: 'Grace', email: 'grace@homelab.example' });
  const myId = async (cookie: string) =>
    ((await accounts.call('GET', '/api/session', { cookie })).json as { user: { id: string } }).user.id;

  it('given the administrator, answers 204 and the account, its sessions and its memberships are gone (12)', async () => {
    const cookie = await accounts.signedIn();
    const { user } = await grace();
    const workspaceId = accounts.workspaces.a.workspace.id;
    await addMember(accounts.db(), { workspaceId, userId: user.id, role: 'editor' });
    const graceCookie = await accounts.signInAs('grace@homelab.example');

    const { status } = await accounts.call('DELETE', `/api/users/${user.id}`, { cookie });

    expect(status).toBe(204);
    expect(await accounts.db().selectFrom('user').select('id').where('id', '=', user.id).execute()).toEqual([]);
    expect(await membersOf(accounts.db(), workspaceId)).toEqual({});
    expect((await accounts.call('GET', '/api/session', { cookie: graceCookie })).json).toBeNull();
  });

  it('keeps the invitations it created, with no inviter (12)', async () => {
    const cookie = await accounts.signedIn();
    const { user } = await grace();
    const workspaceId = accounts.workspaces.a.workspace.id;
    await addMember(accounts.db(), { workspaceId, userId: user.id, role: 'admin' });
    const { invitation } = await createInvitation(accounts.db(), {
      workspaceId, email: 'alan@homelab.example', role: 'viewer', invitedById: user.id,
    });

    await accounts.call('DELETE', `/api/users/${user.id}`, { cookie });

    expect(await accounts.db().selectFrom('invitation').select('invitedById').where('id', '=', invitation.id).execute())
      .toEqual([{ invitedById: null }]);
  });

  it('given their own id, answers 409 cannot_remove_self (13)', async () => {
    const cookie = await accounts.signedIn();

    const { status, json } = await accounts.call('DELETE', `/api/users/${await myId(cookie)}`, { cookie });

    expect(status).toBe(409);
    expect(json).toMatchObject({ type: 'urn:stackmap:problem:cannot_remove_self' });
  });

  it('given the only owner of workspaces, answers 409 last_owner naming them, and changes nothing (14)', async () => {
    const cookie = await accounts.signedIn();
    const { user } = await grace();
    const { a, b } = accounts.workspaces;
    // Setup made the administrator an owner of every workspace: Grace is to be the only one.
    await accounts.db().deleteFrom('member').where('userId', '=', await myId(cookie)).execute();
    await addMember(accounts.db(), { workspaceId: a.workspace.id, userId: user.id, role: 'owner' });
    await addMember(accounts.db(), { workspaceId: b.workspace.id, userId: user.id, role: 'owner' });

    const { status, json } = await accounts.call('DELETE', `/api/users/${user.id}`, { cookie });

    expect(status).toBe(409);
    expect(json).toMatchObject({ type: 'urn:stackmap:problem:last_owner' });
    for (const name of [a.workspace.name, b.workspace.name]) {
      expect((json as { detail: string }).detail).toContain(name);
    }
    expect(await membersOf(accounts.db(), a.workspace.id)).toEqual({ [user.id]: 'owner' });
  });

  it('given an owner with a second owner in the workspace, removes the account (14)', async () => {
    // Setup made the administrator an owner of every workspace.
    const cookie = await accounts.signedIn();
    const { user } = await grace();
    const workspaceId = accounts.workspaces.a.workspace.id;
    await addMember(accounts.db(), { workspaceId, userId: user.id, role: 'owner' });

    expect((await accounts.call('DELETE', `/api/users/${user.id}`, { cookie })).status).toBe(204);
  });

  it('given another administrator, removes the account (15)', async () => {
    const cookie = await accounts.signedIn();
    const { user } = await grace();
    await accounts.call('PATCH', `/api/users/${user.id}`, { cookie, body: { role: 'admin' } });

    expect((await accounts.call('DELETE', `/api/users/${user.id}`, { cookie })).status).toBe(204);
  });

  it('given an unknown id, answers 404 user_not_found (16)', async () => {
    const cookie = await accounts.signedIn();

    const { status, json } = await accounts.call('DELETE', '/api/users/0199d6a0-0000-7000-8000-000000000999', { cookie });

    expect(status).toBe(404);
    expect(json).toMatchObject({ type: 'urn:stackmap:problem:user_not_found' });
  });

  it('given a plain user, answers 403', async () => {
    await accounts.signedIn();
    const { user } = await grace();
    const cookie = await accounts.signInAs('grace@homelab.example');

    expect((await accounts.call('DELETE', `/api/users/${user.id}`, { cookie })).status).toBe(403);
  });
});
