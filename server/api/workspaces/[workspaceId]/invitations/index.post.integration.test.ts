import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import handler from './index.post';
import { createMember } from '../../../../../tests/support/accounts';
import { DIALECTS } from '../../../../../tests/support/databases';
import { serveRoute } from '../../../../../tests/support/requests';
import { useTestWorkspaces } from '../../../../../tests/support/workspaces';
import { createInvitation, findInvitation, pendingInvitations } from '../../../../repositories/invitations';
import { setDatabase } from '../../../../utils/database';
import { setSessionResolver } from '../../../../utils/session';

import type { WorkspaceRole } from '../../../../../shared/contracts/contract';
import type { Dialect } from '../../../../../tests/support/databases';
import type { Database } from '../../../../database/types/schema';
import type { Kysely } from 'kysely';

const post = serveRoute('post', '/api/workspaces/:workspaceId/invitations', handler);
const DAY = 24 * 60 * 60 * 1000;

describe.each(DIALECTS)('POST /api/workspaces/:workspaceId/invitations on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const path = () => `/api/workspaces/${workspaces.a.workspace.id}/invitations`;
  const signInAs = async (role: WorkspaceRole) => {
    const session = await createMember(db(), workspaces.a.workspace.id, role, { name: 'Ada', email: 'ada@homelab.example' });
    setSessionResolver(() => Promise.resolve(session));
    return session;
  };

  beforeEach(() => {
    setDatabase(Promise.resolve(db()));
  });
  afterEach(() => {
    setSessionResolver();
  });

  it('given an admin, answers 201 with the invitation, a 7-day expiry and a one-time /invite/<token> link (1)', async () => {
    await signInAs('admin');
    const before = Date.now();

    const { status, json } = await post(path(), { body: { email: 'Alan@homelab.example', role: 'editor' } });

    expect(status).toBe(201);
    const { invitation, url } = json as { invitation: { expiresAt: string }; url: string };
    expect(invitation).toMatchObject({ email: 'alan@homelab.example', role: 'editor', invitedBy: 'Ada' });
    expect(Date.parse(invitation.expiresAt) - before).toBeGreaterThanOrEqual(7 * DAY - 1000);
    expect(url).toMatch(/^\/invite\/[\w-]{43}$/);
    expect(await findInvitation(db(), url.slice('/invite/'.length))).toMatchObject({ email: 'alan@homelab.example' });
  });

  it('given an admin inviting as admin or owner, answers 403; an owner may invite any role (2)', async () => {
    await signInAs('admin');
    for (const role of ['admin', 'owner']) {
      expect(await post(path(), { body: { email: 'alan@homelab.example', role } }), role)
        .toMatchObject({ status: 403, json: { code: 'forbidden' } });
    }

    await db().updateTable('member').set({ role: 'owner' }).execute();
    for (const role of ['owner', 'admin', 'editor', 'viewer']) {
      expect((await post(path(), { body: { email: `${role}@homelab.example`, role } })).status, role).toBe(201);
    }
  });

  it('given the email of a member, answers 409 already_member (3)', async () => {
    await signInAs('owner');
    await createMember(db(), workspaces.a.workspace.id, 'viewer', { name: 'Grace', email: 'grace@homelab.example' });

    expect(await post(path(), { body: { email: 'GRACE@homelab.example', role: 'editor' } }))
      .toMatchObject({ status: 409, json: { code: 'already_member' } });
  });

  it('given an editor or a viewer, answers 403; given a non-member, 404 (5)', async () => {
    for (const role of ['editor', 'viewer'] as const) {
      await db().deleteFrom('user').execute();
      await signInAs(role);
      expect((await post(path(), { body: { email: 'alan@homelab.example', role: 'viewer' } })).status, role).toBe(403);
    }
    expect((await post(`/api/workspaces/${workspaces.b.workspace.id}/invitations`, {
      body: { email: 'alan@homelab.example', role: 'viewer' },
    })).status).toBe(404);
  });

  it('given an owner\'s invitation as admin or owner, refuses to let an admin replace it: 403 (security review)', async () => {
    const owner = await createMember(db(), workspaces.a.workspace.id, 'owner', { name: 'Alan', email: 'alan@homelab.example' });
    await createInvitation(db(), { workspaceId: workspaces.a.workspace.id, email: 'linus@homelab.example', role: 'owner', invitedById: owner.user.id });
    await signInAs('admin');

    expect(await post(path(), { body: { email: 'linus@homelab.example', role: 'viewer' } }))
      .toMatchObject({ status: 403, json: { code: 'forbidden' } });
    expect(await pendingInvitations(db(), workspaces.a.workspace.id)).toMatchObject([{ role: 'owner' }]);
  });
});
