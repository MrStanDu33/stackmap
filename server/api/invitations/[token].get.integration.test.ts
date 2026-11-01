import { beforeEach, describe, expect, it } from 'vitest';

import handler from './[token].get';
import { createMember } from '../../../tests/support/accounts';
import { DIALECTS } from '../../../tests/support/databases';
import { serveRoute } from '../../../tests/support/requests';
import { useTestWorkspaces } from '../../../tests/support/workspaces';
import { createInvitation, useInvitation } from '../../repositories/invitations';
import { setDatabase } from '../../utils/database';

import type { Dialect } from '../../../tests/support/databases';
import type { Database } from '../../database/types/schema';
import type { Kysely } from 'kysely';

const get = serveRoute('get', '/api/invitations/:token', handler);

describe.each(DIALECTS)('GET /api/invitations/:token on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const invite = async () => {
    const ada = await createMember(db(), workspaces.a.workspace.id, 'owner', { name: 'Ada', email: 'ada@homelab.example' });
    return createInvitation(db(), {
      workspaceId: workspaces.a.workspace.id, email: 'alan@homelab.example', role: 'editor', invitedById: ada.user.id,
    });
  };

  beforeEach(() => {
    setDatabase(Promise.resolve(db()));
  });

  it('given a valid token, answers the workspace, role, email and inviter, and nothing about whether the account exists (7)', async () => {
    const { token, invitation } = await invite();

    expect(await get(`/api/invitations/${token}`)).toMatchObject({
      status: 200,
      json: {
        workspace: workspaces.a.workspace.name, role: 'editor', email: 'alan@homelab.example', invitedBy: 'Ada',
        expiresAt: invitation.expiresAt.toISOString(),
      },
    });
    expect(Object.keys((await get(`/api/invitations/${token}`)).json as object).sort())
      .toEqual(['email', 'expiresAt', 'invitedBy', 'role', 'workspace']);
  });

  it('given an unknown, expired or used token, answers the same 404 invitation_not_found (7)', async () => {
    const used = await invite();
    const { user } = await createMember(db(), workspaces.b.workspace.id, 'viewer', { name: 'Alan', email: 'alan@homelab.example' });
    await useInvitation(db(), used.invitation.id, user.id);
    const expired = await createInvitation(db(), {
      workspaceId: workspaces.b.workspace.id, email: 'grace@homelab.example', role: 'viewer', invitedById: user.id,
    }, new Date(Date.now() - 8 * 24 * 60 * 60 * 1000));

    for (const token of ['A'.repeat(43), used.token, expired.token]) {
      expect(await get(`/api/invitations/${token}`)).toMatchObject({ status: 404, json: { code: 'invitation_not_found' } });
    }
  });
});
