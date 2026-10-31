import { createApp, createRouter, toWebHandler } from 'h3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import handler from './index.get';
import { createAccount } from '../../../tests/support/accounts';
import { DIALECTS } from '../../../tests/support/databases';
import { createWorkspace, useTestWorkspaces } from '../../../tests/support/workspaces';
import { addMember } from '../../repositories/members';
import { setSessionResolver } from '../../utils/session';

import type { Dialect } from '../../../tests/support/databases';
import type { Database } from '../../database/types/schema';
import type { Kysely } from 'kysely';

const get = async () => {
  const app = createApp().use(createRouter().get('/api/workspaces', handler));
  const response = await toWebHandler(app)(new Request('http://localhost/api/workspaces'));
  return { status: response.status, json: await response.json() as { workspaces: { slug: string; role: string }[] } };
};

afterEach(() => {
  setSessionResolver();
  vi.unstubAllEnvs();
});

describe.each(DIALECTS)('GET /api/workspaces on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;

  it('lists the caller\'s workspaces by name with their role; every workspace as owner for the administrator with the setting on; none without membership (13)', async () => {
    const grace = await createAccount(db(), { name: 'Grace', email: 'grace@homelab.example' });
    const ada = await createAccount(db(), { name: 'Ada', email: 'ada@homelab.example', admin: true });
    const lab = await createWorkspace(db(), { name: 'Lab', slug: 'lab' });
    const home = await createWorkspace(db(), { name: 'Home', slug: 'home' });
    await addMember(db(), { workspaceId: lab.id, userId: grace.user.id, role: 'editor' });
    await addMember(db(), { workspaceId: home.id, userId: grace.user.id, role: 'viewer' });

    setSessionResolver(() => Promise.resolve(grace));
    const { status, json } = await get();
    expect(status).toBe(200);
    expect(json.workspaces).toEqual([
      {
        id: home.id, name: 'Home', slug: 'home', role: 'viewer',
        createdAt: home.createdAt.toISOString(), updatedAt: home.updatedAt.toISOString(),
      },
      {
        id: lab.id, name: 'Lab', slug: 'lab', role: 'editor',
        createdAt: lab.createdAt.toISOString(), updatedAt: lab.updatedAt.toISOString(),
      },
    ]);

    setSessionResolver(() => Promise.resolve(ada));
    expect(await get()).toEqual({ status: 200, json: { workspaces: [] } });

    vi.stubEnv('INSTANCE_ADMIN_ALL_WORKSPACES', 'true');
    const all = (await get()).json.workspaces;
    // A and B are named "Workspace <n>": after Home and Lab, in either order.
    expect(all.map(({ slug }) => slug).slice(0, 2)).toEqual(['home', 'lab']);
    expect(all.map(({ slug }) => slug).slice(2).sort())
      .toEqual([workspaces.a.workspace.slug, workspaces.b.workspace.slug].sort());
    expect(new Set(all.map(({ role }) => role))).toEqual(new Set(['owner']));
  });
});
