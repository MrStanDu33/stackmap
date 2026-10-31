import { createApp, createRouter, toWebHandler } from 'h3';
import { describe, expect, it } from 'vitest';

import handler from './[slug].get';
import { DIALECTS } from '../../../../tests/support/databases';
import { createWorkspace, useTestWorkspaces } from '../../../../tests/support/workspaces';
import { setDatabase } from '../../../utils/database';

import type { Dialect } from '../../../../tests/support/databases';
import type { Database } from '../../../database/types/schema';
import type { Kysely } from 'kysely';

const get = async (slug: string) => {
  const app = createApp().use(createRouter().get('/api/workspaces/by-slug/:slug', handler));
  const response = await toWebHandler(app)(new Request(`http://localhost/api/workspaces/by-slug/${slug}`));
  return { status: response.status, json: await response.json() as unknown };
};

describe.each(DIALECTS)('GET /api/workspaces/by-slug/:slug on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);

  const use = () => {
    const db = workspaces.db as unknown as Kysely<Database>;
    setDatabase(Promise.resolve(db));
    return db;
  };

  it('answers 200 with the workspace\'s id, name, slug and timestamps', async () => {
    const demo = await createWorkspace(use(), { name: 'Demo', slug: 'demo' });

    const { status, json } = await get('demo');

    expect(status).toBe(200);
    expect(json).toEqual({
      id: demo.id, name: 'Demo', slug: 'demo',
      createdAt: demo.createdAt.toISOString(), updatedAt: demo.updatedAt.toISOString(),
    });
  });

  it('answers 404 workspace_not_found as Problem Details for an unknown slug', async () => {
    use();

    expect(await get('nowhere')).toMatchObject({
      status: 404,
      json: { code: 'workspace_not_found', status: 404, instance: '/api/workspaces/by-slug/nowhere' },
    });
  });

  it('answers 400 validation_failed for a malformed slug (upper case, too long, invisible characters)', async () => {
    use();

    for (const slug of ['Demo', 'a'.repeat(49), 'de%E2%80%8Bmo']) {
      expect(await get(slug), slug)
        .toMatchObject({ status: 400, json: { code: 'validation_failed', issues: [{ path: 'params.slug' }] } });
    }
  });
});
