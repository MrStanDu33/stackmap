import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import handler from './index.get';
import { createMember } from '../../../../../tests/support/accounts';
import { DIALECTS } from '../../../../../tests/support/databases';
import { serveRoute } from '../../../../../tests/support/requests';
import { useTestWorkspaces } from '../../../../../tests/support/workspaces';
import { createInvitation } from '../../../../repositories/invitations';
import { setDatabase } from '../../../../utils/database';
import { setSessionResolver } from '../../../../utils/session';

import type { Dialect } from '../../../../../tests/support/databases';
import type { Database } from '../../../../database/types/schema';
import type { Kysely } from 'kysely';

const get = serveRoute('get', '/api/workspaces/:workspaceId/members', handler);

describe.each(DIALECTS)('GET /api/workspaces/:workspaceId/members on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;

  beforeEach(() => {
    setDatabase(Promise.resolve(db()));
  });
  afterEach(() => {
    setSessionResolver();
  });

  it('gives a member the members by name; an admin or owner also gets the pending invitations (13)', async () => {
    const workspaceId = workspaces.a.workspace.id;
    const viewer = await createMember(db(), workspaceId, 'viewer', { name: 'Grace', email: 'grace@homelab.example' });
    const owner = await createMember(db(), workspaceId, 'owner', { name: 'Ada', email: 'ada@homelab.example' });
    await createInvitation(db(), { workspaceId, email: 'alan@homelab.example', role: 'editor', invitedById: owner.user.id });
    const path = `/api/workspaces/${workspaceId}/members`;

    setSessionResolver(() => Promise.resolve(viewer));
    const asViewer = await get(path);
    expect(asViewer.status).toBe(200);
    const { members } = asViewer.json as { members: { name: string; email: string; role: string; joinedAt: string }[] };
    expect(members.map(({ name, email, role }) => [name, email, role])).toEqual([
      ['Ada', 'ada@homelab.example', 'owner'],
      ['Grace', 'grace@homelab.example', 'viewer'],
    ]);
    expect(asViewer.json).not.toHaveProperty('invitations');

    setSessionResolver(() => Promise.resolve(owner));
    expect((await get(path)).json).toMatchObject({
      invitations: [{ email: 'alan@homelab.example', role: 'editor', invitedBy: 'Ada' }],
    });
  });
});
