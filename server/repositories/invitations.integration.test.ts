import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createInvitation, findInvitation, pendingInvitations, useInvitation } from './invitations';
import { addMember } from './members';
import { createAccount, createMember, membersOf } from '../../tests/support/accounts';
import { DIALECTS } from '../../tests/support/databases';
import { useTestWorkspaces } from '../../tests/support/workspaces';

import type { Dialect } from '../../tests/support/databases';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

const DAY = 24 * 60 * 60 * 1000;

describe.each(DIALECTS)('workspace invitations on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const ada = () => createMember(db(), workspaces.a.workspace.id, 'owner', { name: 'Ada', email: 'ada@homelab.example' });
  const invite = async (email = 'Alan@Homelab.example', now = new Date()) => {
    const { user } = await ada();
    return createInvitation(db(), { workspaceId: workspaces.a.workspace.id, email, role: 'editor', invitedById: user.id }, now);
  };

  it('stores only the token\'s SHA-256 hash, and finds the invitation by it until it expires (1)', async () => {
    const now = new Date('2026-11-01T09:00:00.000Z');
    const { invitation, token } = await invite(undefined, now);

    expect(token).toMatch(/^[\w-]{43}$/);
    expect(invitation).toMatchObject({ email: 'alan@homelab.example', role: 'editor', invitedBy: 'Ada' });
    expect(invitation.expiresAt.getTime() - now.getTime()).toBe(7 * DAY);
    const rows = await db().selectFrom('invitation').select(['tokenHash']).execute();
    expect(rows).toEqual([{ tokenHash: createHash('sha256').update(token).digest('hex') }]);

    expect(await findInvitation(db(), token, new Date(now.getTime() + 7 * DAY - 1)))
      .toMatchObject({ id: invitation.id, workspace: { slug: workspaces.a.workspace.slug } });
    expect(await findInvitation(db(), token, new Date(now.getTime() + 7 * DAY + 1))).toBeUndefined();
    expect(await findInvitation(db(), 'A'.repeat(43), now)).toBeUndefined();
  });

  it('replaces a pending invitation for the same email and workspace: the old token stops working (4)', async () => {
    const first = await invite();
    const { user } = await createMember(db(), workspaces.a.workspace.id, 'admin', { name: 'Alan', email: 'alan.turing@homelab.example' });
    const second = await createInvitation(db(), {
      workspaceId: workspaces.a.workspace.id, email: 'alan@homelab.example', role: 'viewer', invitedById: user.id,
    });

    expect(await findInvitation(db(), first.token)).toBeUndefined();
    expect(await findInvitation(db(), second.token)).toMatchObject({ role: 'viewer' });
    expect(await pendingInvitations(db(), workspaces.a.workspace.id)).toHaveLength(1);
  });

  it('deletes an invitation with its workspace', async () => {
    const { token } = await invite();

    await db().deleteFrom('workspace').where('id', '=', workspaces.a.workspace.id).execute();
    expect(await findInvitation(db(), token)).toBeUndefined();
  });

  it('keeps an invitation only while its inviter may still grant its role: demoted, gone from the workspace or deleted, it is no longer found (security review)', async () => {
    const workspaceId = workspaces.a.workspace.id;
    const admin = await createMember(db(), workspaceId, 'admin', { name: 'Grace', email: 'grace@homelab.example' });
    const viaAdmin = (email: string) => createInvitation(db(), { workspaceId, email, role: 'viewer', invitedById: admin.user.id });

    const demoted = await viaAdmin('one@homelab.example');
    await db().updateTable('member').set({ role: 'editor' }).where('userId', '=', admin.user.id).execute();
    expect(await findInvitation(db(), demoted.token)).toBeUndefined();
    expect(await pendingInvitations(db(), workspaceId)).toEqual([]);

    await db().updateTable('member').set({ role: 'admin' }).where('userId', '=', admin.user.id).execute();
    const left = await viaAdmin('two@homelab.example');
    await db().deleteFrom('member').where('userId', '=', admin.user.id).execute();
    expect(await findInvitation(db(), left.token)).toBeUndefined();

    const owner = await ada();
    const deleted = await createInvitation(db(), { workspaceId, email: 'three@homelab.example', role: 'owner', invitedById: owner.user.id });
    await db().deleteFrom('user').where('id', '=', owner.user.id).execute();
    expect(await findInvitation(db(), deleted.token)).toBeUndefined();
  });

  it('uses an invitation once: of two acceptances at once, one adds the member', async () => {
    const { invitation, token } = await invite();
    const alan = await createAccount(db(), { name: 'Alan', email: 'alan@homelab.example' });

    const accept = () => useInvitation(db(), invitation.id, alan.user.id);
    const results = await Promise.all([accept(), accept()]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await membersOf(db(), workspaces.a.workspace.id))[alan.user.id]).toBe('editor');
    expect(await findInvitation(db(), token)).toBeUndefined();
  });

  it('keeps an existing member\'s role when they accept another invitation', async () => {
    const { invitation } = await invite();
    const alan = await createAccount(db(), { name: 'Alan', email: 'alan@homelab.example' });
    await addMember(db(), { workspaceId: workspaces.a.workspace.id, userId: alan.user.id, role: 'owner' });

    expect(await useInvitation(db(), invitation.id, alan.user.id)).toBe(true);
    expect((await membersOf(db(), workspaces.a.workspace.id))[alan.user.id]).toBe('owner');
  });
});
