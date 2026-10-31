import { createApp, createRouter, toWebHandler } from 'h3';
import { describe, expect, it } from 'vitest';

import handler from './index.get';
import { DIALECTS } from '../../../tests/support/databases';
import { createWorkspace, useTestWorkspaces } from '../../../tests/support/workspaces';
import { setDatabase } from '../../utils/database';

import type { Dialect } from '../../../tests/support/databases';
import type { Database } from '../../database/types/schema';
import type { Kysely } from 'kysely';

const get = async (query: string) => {
  const app = createApp().use(createRouter().get('/api/workspaces', handler));
  const response = await toWebHandler(app)(new Request(`http://localhost/api/workspaces?${query}`));
  return { status: response.status, json: await response.json() as unknown };
};

describe.each(DIALECTS)('GET /api/workspaces?slug= on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);

  const use = () => {
    const db = workspaces.db as unknown as Kysely<Database>;
    setDatabase(Promise.resolve(db));
    return db;
  };

  it('answers 200 with the workspace alone: its id, name, slug and timestamps', async () => {
    const demo = await createWorkspace(use(), { name: 'Demo', slug: 'demo' });

    const { status, json } = await get('slug=demo');

    expect(status).toBe(200);
    expect(json).toEqual({
      workspaces: [{
        id: demo.id, name: 'Demo', slug: 'demo',
        createdAt: demo.createdAt.toISOString(), updatedAt: demo.updatedAt.toISOString(),
      }],
    });
  });

  it('answers 200 with no workspace before the demo workspace exists', async () => {
    use();

    expect(await get('slug=demo')).toEqual({ status: 200, json: { workspaces: [] } });
  });

  it('answers 400 for any slug but demo until accounts exist, so it cannot reveal another workspace\'s id', async () => {
    await createWorkspace(use(), { name: 'Home', slug: 'home' });

    expect(await get('slug=home'))
      .toMatchObject({ status: 400, json: { code: 'validation_failed', issues: [{ path: 'query.slug' }] } });
  });

  it('answers 400 validation_failed for a missing or malformed slug (upper case, too long, invisible characters)', async () => {
    use();

    for (const query of ['', 'slug=Demo', `slug=${'a'.repeat(49)}`, 'slug=de%E2%80%8Bmo']) {
      expect(await get(query), query)
        .toMatchObject({ status: 400, json: { code: 'validation_failed', issues: [{ path: 'query.slug' }] } });
    }
  });
});
