import { createApp, createRouter, toWebHandler } from 'h3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defineContractHandler } from './contract-handler';
import { setDatabase } from './database';
import { setSessionResolver } from './session';
import { defineContract, WORKSPACE_ROLES } from '../../shared/contracts/contract';
import { createAccount } from '../../tests/support/accounts';
import { DIALECTS } from '../../tests/support/databases';
import { useTestWorkspaces } from '../../tests/support/workspaces';
import { addMember } from '../repositories/members';

import type { Session } from '../../shared/contracts/auth';
import type { Role, WorkspaceRole } from '../../shared/contracts/contract';
import type { Dialect } from '../../tests/support/databases';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

const UNKNOWN = '0199d6a0-0000-7000-8000-00000000ffff';

const answer = {
  description: 'The workspace and the caller\'s role',
  schema: z.object({ id: z.string(), role: z.string() }),
  examples: { owner: { summary: 'An owner', value: { id: UNKNOWN, role: 'owner' } } },
};

/** A change in a workspace, with a body to check that nothing is read before the membership. */
const renameThing = (requiredRole: WorkspaceRole) => defineContract({
  method: 'post',
  path: '/api/workspaces/:workspaceId/things',
  operationId: 'renameThing',
  summary: 'Rename a thing',
  description: 'Renames a thing of the workspace.',
  tags: ['Things'],
  requiredRole,
  params: z.object({ workspaceId: z.uuid() }),
  body: z.object({ name: z.string().min(1) }),
  responses: { 200: answer },
});

const instanceThing = defineContract({
  method: 'post',
  path: '/api/things',
  operationId: 'resetThings',
  summary: 'Reset things',
  description: 'Resets every thing of the instance.',
  tags: ['Things'],
  requiredRole: 'instanceAdmin' satisfies Role,
  responses: { 200: { ...answer, schema: z.object({ ok: z.boolean() }), examples: { ok: { summary: 'Done', value: { ok: true } } } } },
});

const serve = (requiredRole: WorkspaceRole) => {
  const handler = defineContractHandler(renameThing(requiredRole), ({ workspace }) =>
    ({ status: 200, body: { id: workspace.id, role: workspace.role } }));
  const app = toWebHandler(createApp().use(createRouter().post('/api/workspaces/:workspaceId/things', handler)));
  return async (workspaceId: string, body: unknown = { name: 'Proxy' }) => {
    const response = await app(new Request(`http://localhost/api/workspaces/${workspaceId}/things`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }));
    return { status: response.status, json: await response.json() as Record<string, unknown> };
  };
};

describe.each(DIALECTS)('workspace authorization on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const signIn = (session: Session) => {
    setSessionResolver(() => Promise.resolve(session));
  };

  beforeEach(() => {
    setDatabase(Promise.resolve(db()));
  });
  afterEach(() => {
    setSessionResolver();
    vi.unstubAllEnvs();
  });

  it('answers 404 workspace_not_found to a non-member, as for an unknown id, before reading the input (7)', async () => {
    signIn(await createAccount(db(), { name: 'Grace', email: 'grace@homelab.example' }));
    const call = serve('viewer');

    const notMember = await call(workspaces.a.workspace.id, { name: '' });
    const unknown = await call(UNKNOWN, { name: '' });

    expect(notMember).toMatchObject({ status: 404, json: { code: 'workspace_not_found' } });
    expect(unknown).toMatchObject({ status: 404, json: { code: 'workspace_not_found' } });
    expect({ ...notMember.json, instance: undefined, detail: undefined })
      .toEqual({ ...unknown.json, instance: undefined, detail: undefined });
  });

  it('answers 403 to a member below the operation\'s role, and lets each role at or above it through (8)', async () => {
    const grace = await createAccount(db(), { name: 'Grace', email: 'grace@homelab.example' });
    signIn(grace);
    const workspaceId = workspaces.a.workspace.id;
    await addMember(db(), { workspaceId, userId: grace.user.id, role: 'viewer' });

    const wrong = [];
    for (const [rank, memberRole] of WORKSPACE_ROLES.entries()) {
      await db().updateTable('member').set({ role: memberRole }).where('userId', '=', grace.user.id).execute();
      for (const [needed, requiredRole] of WORKSPACE_ROLES.entries()) {
        const { status, json } = await serve(requiredRole)(workspaceId);
        const expected = rank >= needed ? { status: 200, role: memberRole } : { status: 403, role: undefined };
        if (status !== expected.status || (status === 200 && json.role !== expected.role)
          || (status === 403 && json.code !== 'forbidden')) {
          wrong.push(`${memberRole} on ${requiredRole}: ${String(status)} ${JSON.stringify(json)}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('with INSTANCE_ADMIN_ALL_WORKSPACES on, the instance administrator reaches every workspace as owner; off or anything else, 404 (9)', async () => {
    signIn(await createAccount(db(), { name: 'Ada', email: 'ada@homelab.example', admin: true }));
    const call = serve('owner');

    for (const value of ['true', '1', 'YES', 'on']) {
      vi.stubEnv('INSTANCE_ADMIN_ALL_WORKSPACES', value);
      expect(await call(workspaces.b.workspace.id), value)
        .toEqual({ status: 200, json: { id: workspaces.b.workspace.id, role: 'owner' } });
    }
    for (const value of [undefined, '', 'false', 'maybe']) {
      vi.stubEnv('INSTANCE_ADMIN_ALL_WORKSPACES', value);
      expect((await call(workspaces.b.workspace.id)).status, String(value)).toBe(404);
    }
    // A plain user gets nothing from it.
    vi.stubEnv('INSTANCE_ADMIN_ALL_WORKSPACES', 'true');
    signIn(await createAccount(db(), { name: 'Grace', email: 'grace@homelab.example' }));
    expect((await call(workspaces.b.workspace.id)).status).toBe(404);
  });

  it('answers 403 to an instanceAdmin operation called by another user (10)', async () => {
    const handler = defineContractHandler(instanceThing, () => ({ status: 200, body: { ok: true } }));
    const app = toWebHandler(createApp().use(createRouter().post('/api/things', handler)));
    const call = async () => (await app(new Request('http://localhost/api/things', { method: 'POST' }))).status;

    signIn(await createAccount(db(), { name: 'Grace', email: 'grace@homelab.example' }));
    expect(await call()).toBe(403);
    signIn(await createAccount(db(), { name: 'Ada', email: 'ada@homelab.example', admin: true }));
    expect(await call()).toBe(200);
  });
});
