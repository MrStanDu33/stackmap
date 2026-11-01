import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import handler from './[userId].delete';
import { WORKSPACE_ROLES } from '../../../../../shared/contracts/contract';
import { createAccount, createMember, membersOf } from '../../../../../tests/support/accounts';
import { DIALECTS } from '../../../../../tests/support/databases';
import { serveRoute } from '../../../../../tests/support/requests';
import { useTestWorkspaces } from '../../../../../tests/support/workspaces';
import { setDatabase } from '../../../../utils/database';
import { setSessionResolver } from '../../../../utils/session';

import type { WorkspaceRole } from '../../../../../shared/contracts/contract';
import type { Dialect } from '../../../../../tests/support/databases';
import type { Database } from '../../../../database/types/schema';
import type { Kysely } from 'kysely';

const call = serveRoute('delete', '/api/workspaces/:workspaceId/members/:userId', handler);
const MANAGED_BY_ADMINS = new Set<WorkspaceRole>(['editor', 'viewer']);

describe.each(DIALECTS)('DELETE /api/workspaces/:workspaceId/members/:userId on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const workspaceId = () => workspaces.a.workspace.id;
  const path = (userId: string) => `/api/workspaces/${workspaceId()}/members/${userId}`;
  const setRole = (userId: string, role: WorkspaceRole) =>
    db().updateTable('member').set({ role }).where('userId', '=', userId).execute();
  /** The caller, the member they act on, and another owner, so the workspace never runs out of owners by accident. */
  const cast = async () => {
    const actor = await createMember(db(), workspaceId(), 'viewer', { name: 'Ada', email: 'ada@homelab.example' });
    const target = await createMember(db(), workspaceId(), 'viewer', { name: 'Grace', email: 'grace@homelab.example' });
    await createMember(db(), workspaceId(), 'owner', { name: 'Alan', email: 'alan@homelab.example' });
    setSessionResolver(() => Promise.resolve(actor));
    return { actor: actor.user.id, target: target.user.id };
  };

  beforeEach(() => {
    setDatabase(Promise.resolve(db()));
  });
  afterEach(() => {
    setSessionResolver();
  });

  it('applies the admin and owner rules, and lets any member remove themselves (15)', async () => {
    const wrong = [];
    for (const actorRole of WORKSPACE_ROLES) {
      for (const targetRole of WORKSPACE_ROLES) {
        await db().deleteFrom('user').execute();
        const { actor, target } = await cast();
        await setRole(actor, actorRole);
        await setRole(target, targetRole);
        const allowed = actorRole === 'owner' || (actorRole === 'admin' && MANAGED_BY_ADMINS.has(targetRole));
        const { status } = await call(path(target));
        const gone = !(target in await membersOf(db(), workspaceId()));
        if (status !== (allowed ? 204 : 403) || gone !== allowed) {
          wrong.push(`${actorRole} removes ${targetRole}: ${String(status)}`);
        }
      }
    }
    expect(wrong).toEqual([]);

    for (const role of WORKSPACE_ROLES) {
      await db().deleteFrom('user').execute();
      const { actor } = await cast();
      await setRole(actor, role);
      expect((await call(path(actor))).status, `a ${role} leaves`).toBe(204);
    }
  });

  it('refuses to remove the last owner, or let them leave, with 409 last_owner (16)', async () => {
    const owner = await createMember(db(), workspaceId(), 'owner', { name: 'Ada', email: 'ada@homelab.example' });
    setSessionResolver(() => Promise.resolve(owner));

    expect(await call(path(owner.user.id))).toMatchObject({ status: 409, json: { code: 'last_owner' } });
    expect((await membersOf(db(), workspaceId()))[owner.user.id]).toBe('owner');
  });

  it('answers 404 member_not_found for a user who is not a member (17)', async () => {
    const { actor } = await cast();
    await setRole(actor, 'owner');
    const stranger = await createAccount(db(), { name: 'Mallory', email: 'mallory@homelab.example' });

    expect(await call(path(stranger.user.id))).toMatchObject({ status: 404, json: { code: 'member_not_found' } });
  });
});
