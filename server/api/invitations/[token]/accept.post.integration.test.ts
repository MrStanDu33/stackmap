import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import handler from './accept.post';
import { createAccount, createMember, membersOf } from '../../../../tests/support/accounts';
import { DIALECTS } from '../../../../tests/support/databases';
import { serveRoute } from '../../../../tests/support/requests';
import { useTestWorkspaces } from '../../../../tests/support/workspaces';
import { createInvitation, findInvitation } from '../../../repositories/invitations';
import { addMember } from '../../../repositories/members';
import { setDatabase } from '../../../utils/database';
import { setSessionResolver } from '../../../utils/session';

import type { Session } from '../../../../shared/contracts/auth';
import type { Dialect } from '../../../../tests/support/databases';
import type { Database } from '../../../database/types/schema';
import type { Kysely } from 'kysely';

const post = serveRoute('post', '/api/invitations/:token/accept', handler);

describe.each(DIALECTS)('POST /api/invitations/:token/accept on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const invite = async () => {
    const ada = await createMember(db(), workspaces.a.workspace.id, 'owner', { name: 'Ada', email: 'ada@homelab.example' });
    return createInvitation(db(), {
      workspaceId: workspaces.a.workspace.id, email: 'alan@homelab.example', role: 'editor', invitedById: ada.user.id,
    });
  };
  const signInAs = (session: Session) => {
    setSessionResolver(() => Promise.resolve(session));
  };

  beforeEach(() => {
    setDatabase(Promise.resolve(db()));
  });
  afterEach(() => {
    setSessionResolver();
  });

  it('given the invited account signed in, makes it a member with the role, uses the invitation and answers the slug (10)', async () => {
    const { token } = await invite();
    const alan = await createAccount(db(), { name: 'Alan', email: 'Alan@Homelab.example' });
    signInAs(alan);

    expect(await post(`/api/invitations/${token}/accept`))
      .toEqual({ status: 200, json: { slug: workspaces.a.workspace.slug }, headers: expect.anything() as unknown });
    expect((await membersOf(db(), workspaces.a.workspace.id))[alan.user.id]).toBe('editor');
    expect(await findInvitation(db(), token)).toBeUndefined();
  });

  it('given another account signed in, answers 403 invitation_email_mismatch (10)', async () => {
    const { token } = await invite();
    signInAs(await createAccount(db(), { name: 'Grace', email: 'grace@homelab.example' }));

    expect(await post(`/api/invitations/${token}/accept`))
      .toMatchObject({ status: 403, json: { code: 'invitation_email_mismatch' } });
    expect(await findInvitation(db(), token)).toBeDefined();
  });

  it('given someone already a member, uses the invitation and keeps their role', async () => {
    const { token } = await invite();
    const alan = await createAccount(db(), { name: 'Alan', email: 'alan@homelab.example' });
    await addMember(db(), { workspaceId: workspaces.a.workspace.id, userId: alan.user.id, role: 'admin' });
    signInAs(alan);

    expect((await post(`/api/invitations/${token}/accept`)).status).toBe(200);
    expect((await membersOf(db(), workspaces.a.workspace.id))[alan.user.id]).toBe('admin');
  });

  it('given an inviter who can no longer grant the role, answers 404 and adds no one (security review)', async () => {
    const { token } = await invite();
    await db().updateTable('member').set({ role: 'viewer' }).where('workspaceId', '=', workspaces.a.workspace.id).execute();
    const alan = await createAccount(db(), { name: 'Alan', email: 'alan@homelab.example' });
    signInAs(alan);

    expect(await post(`/api/invitations/${token}/accept`)).toMatchObject({ status: 404, json: { code: 'invitation_not_found' } });
    expect(await membersOf(db(), workspaces.a.workspace.id)).not.toHaveProperty(alan.user.id);
  });

  it('given 5 attempts from one address within a minute, answers the 6th 429 (11)', async () => {
    signInAs(await createAccount(db(), { name: 'Grace', email: 'grace@homelab.example' }));
    const attempt = () => post(`/api/invitations/${'A'.repeat(43)}/accept`, { ip: '192.0.2.78' });

    for (let n = 0; n < 5; n += 1) {
      expect((await attempt()).status).toBe(404);
    }
    expect((await attempt()).status).toBe(429);
  });
});
