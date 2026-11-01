import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import handler from './[invitationId].delete';
import { createMember } from '../../../../../tests/support/accounts';
import { DIALECTS } from '../../../../../tests/support/databases';
import { serveRoute } from '../../../../../tests/support/requests';
import { useTestWorkspaces } from '../../../../../tests/support/workspaces';
import { createInvitation, findInvitation } from '../../../../repositories/invitations';
import { setDatabase } from '../../../../utils/database';
import { setSessionResolver } from '../../../../utils/session';

import type { Dialect } from '../../../../../tests/support/databases';
import type { Database } from '../../../../database/types/schema';
import type { Kysely } from 'kysely';

const remove = serveRoute('delete', '/api/workspaces/:workspaceId/invitations/:invitationId', handler);

describe.each(DIALECTS)('DELETE /api/workspaces/:workspaceId/invitations/:invitationId on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const setUp = async () => {
    const admin = await createMember(db(), workspaces.a.workspace.id, 'admin', { name: 'Ada', email: 'ada@homelab.example' });
    setSessionResolver(() => Promise.resolve(admin));
    const invite = (workspaceId: string) => createInvitation(db(), {
      workspaceId, email: 'alan@homelab.example', role: 'viewer', invitedById: admin.user.id,
    });
    return { a: await invite(workspaces.a.workspace.id), b: await invite(workspaces.b.workspace.id) };
  };

  beforeEach(() => {
    setDatabase(Promise.resolve(db()));
  });
  afterEach(() => {
    setSessionResolver();
  });

  it('given an admin, revokes it: 204, and its link answers 404 (6)', async () => {
    const { a } = await setUp();

    const { status } = await remove(`/api/workspaces/${workspaces.a.workspace.id}/invitations/${a.invitation.id}`);

    expect(status).toBe(204);
    expect(await findInvitation(db(), a.token)).toBeUndefined();
  });

  it('given an invitation of another workspace, answers 404 (6)', async () => {
    const { b } = await setUp();

    expect(await remove(`/api/workspaces/${workspaces.a.workspace.id}/invitations/${b.invitation.id}`))
      .toMatchObject({ status: 404, json: { code: 'invitation_not_found' } });
    expect(await findInvitation(db(), b.token)).toBeDefined();
  });

  it('given an admin and an invitation as owner, answers 403 and keeps it (security review)', async () => {
    const owner = await createMember(db(), workspaces.a.workspace.id, 'owner', { name: 'Alan', email: 'alan@homelab.example' });
    const { invitation, token } = await createInvitation(db(), {
      workspaceId: workspaces.a.workspace.id, email: 'linus@homelab.example', role: 'owner', invitedById: owner.user.id,
    });
    await setUp();

    expect(await remove(`/api/workspaces/${workspaces.a.workspace.id}/invitations/${invitation.id}`))
      .toMatchObject({ status: 403, json: { code: 'forbidden' } });
    expect(await findInvitation(db(), token)).toBeDefined();
  });
});
