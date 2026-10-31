import { createApp, createRouter, toWebHandler } from 'h3';
import { afterEach, describe, expect, it } from 'vitest';

import handler from './index.post';
import { createAccount, membersOf } from '../../../tests/support/accounts';
import { DIALECTS } from '../../../tests/support/databases';
import { useTestWorkspaces } from '../../../tests/support/workspaces';
import { setSessionResolver } from '../../utils/session';

import type { Dialect } from '../../../tests/support/databases';
import type { Database } from '../../database/types/schema';
import type { Kysely } from 'kysely';

const post = async (body: unknown) => {
  const app = createApp().use(createRouter().post('/api/workspaces', handler));
  const response = await toWebHandler(app)(new Request('http://localhost/api/workspaces', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { status: response.status, json: await response.json() as Record<string, unknown> };
};

afterEach(() => {
  setSessionResolver();
});

describe.each(DIALECTS)('POST /api/workspaces on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const asAdmin = async () => {
    const ada = await createAccount(db(), { name: 'Ada', email: 'ada@homelab.example', admin: true });
    setSessionResolver(() => Promise.resolve(ada));
    return ada;
  };
  const count = async () => (await db().selectFrom('workspace').select('id').execute()).length;

  it('given the instance administrator, creates the workspace with them as owner: 201 with role owner (14)', async () => {
    const ada = await asAdmin();

    const { status, json } = await post({ name: '  Homelab ', slug: 'homelab' });

    expect(status).toBe(201);
    expect(json).toEqual({
      id: expect.any(String) as unknown, name: 'Homelab', slug: 'homelab', role: 'owner',
      createdAt: expect.any(String) as unknown, updatedAt: expect.any(String) as unknown,
    });
    expect(await membersOf(db(), json.id as string)).toEqual({ [ada.user.id]: 'owner' });
  });

  it('given a taken slug, answers 409 workspace_slug_taken and creates nothing (15)', async () => {
    await asAdmin();
    const before = await count();

    expect(await post({ name: 'Again', slug: workspaces.a.workspace.slug }))
      .toMatchObject({ status: 409, json: { code: 'workspace_slug_taken', status: 409 } });
    expect(await count()).toBe(before);
  });

  it('given an invalid name or slug, answers 400 validation_failed with the issues (16)', async () => {
    await asAdmin();
    const cases: [unknown, string][] = [
      [{ name: '', slug: 'ok' }, 'body.name'],
      [{ name: '   ', slug: 'ok' }, 'body.name'],
      [{ name: 'x'.repeat(101), slug: 'ok' }, 'body.name'],
      [{ name: 'Bell\u0007', slug: 'ok' }, 'body.name'],
      [{ name: 'Ok', slug: 'Not Kebab' }, 'body.slug'],
      [{ name: 'Ok', slug: 'a'.repeat(49) }, 'body.slug'],
      [{ name: 'Ok' }, 'body.slug'],
    ];
    for (const [body, path] of cases) {
      expect(await post(body), JSON.stringify(body))
        .toMatchObject({ status: 400, json: { code: 'validation_failed', issues: [{ path }] } });
    }
    expect(await count()).toBe(2);
  });

  it('given another user, answers 403 before reading the body (17)', async () => {
    const grace = await createAccount(db(), { name: 'Grace', email: 'grace@homelab.example' });
    setSessionResolver(() => Promise.resolve(grace));

    expect(await post({ name: '' })).toMatchObject({ status: 403, json: { code: 'forbidden' } });
    expect(await count()).toBe(2);
  });
});
