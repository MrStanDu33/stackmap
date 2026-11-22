import { createHost } from '@stackmap/extension-core/testing';
import { describe, expect, it } from 'vitest';

import handler from './search.get';
import { DIALECTS } from '../../../../tests/support/databases';
import { useEntityApi } from '../../../../tests/support/entity-api';
import { createPortForwards } from '../../../../tests/support/nat';
import { serveRoute } from '../../../../tests/support/requests';

import type { Dialect } from '../../../../tests/support/databases';

const get = serveRoute('get', '/api/workspaces/:workspaceId/search', handler);

describe.each(DIALECTS)('GET /api/workspaces/:workspaceId/search on %s', (dialect: Dialect) => {
  const { workspaces, signInAs } = useEntityApi(dialect);
  const path = (query: string) => `/api/workspaces/${workspaces.a.workspace.id}/search?${query}`;

  it('given q=router, answers 200 with items naming each entity\'s extension, type, id, title and matched field (16)', async () => {
    const router = await createHost(workspaces.a.repos, { name: 'Edge router' });
    await signInAs('viewer');

    const { status, json } = await get(path('q=router'));

    expect(status).toBe(200);
    expect(json).toEqual({
      items: [{ extension: 'core', entity: 'host', id: router.id, title: 'Edge router', matched: 'name' }],
      truncated: false,
    });
  });

  it('says truncated when more entities match than limit (16)', async () => {
    await createHost(workspaces.a.repos, { name: 'Router one' });
    await createHost(workspaces.a.repos, { name: 'Router two' });
    await signInAs('editor');

    const { json } = await get(path('q=router&limit=1'));

    expect(json).toMatchObject({ items: [{ title: 'Router one' }], truncated: true });
  });

  it('answers 400 to a q that is empty or longer than 100 characters, or a limit outside 1 to 50 (17)', async () => {
    await signInAs('owner');

    for (const query of ['q=', 'q=%20%20', `q=${'a'.repeat(101)}`, 'q=router&limit=0', 'q=router&limit=51', '']) {
      const { status, json } = await get(path(query));

      expect(status, query).toBe(400);
      expect(json).toMatchObject({ code: 'validation_failed' });
    }
  });

  it('given extension=nat&entity=port-forward, answers only those entities (18)', async () => {
    await createPortForwards(workspaces.a.repos);
    await signInAs('viewer');

    const { status, json } = await get(path('q=203.0.113.10&extension=nat&entity=port-forward'));

    expect(status).toBe(200);
    expect(json).toMatchObject({
      items: [{ extension: 'nat', entity: 'port-forward' }, { extension: 'nat', entity: 'port-forward' }],
      truncated: false,
    });
  });

  it('given an unknown extension or entity, answers 200 with no items (18)', async () => {
    await createPortForwards(workspaces.a.repos);
    await signInAs('viewer');

    for (const query of ['extension=unknown', 'entity=unknown', 'extension=nat&entity=host']) {
      const { status, json } = await get(path(`q=203.0.113.10&${query}`));

      expect(status, query).toBe(200);
      expect(json, query).toEqual({ items: [], truncated: false });
    }
  });

  it('answers 400 to an extension or entity that is not a kebab id (18)', async () => {
    await signInAs('viewer');

    for (const query of ['extension=', 'extension=Nat', 'entity=port_forward', `entity=${'a'.repeat(101)}`, 'extension=nat&extension=core']) {
      const { status, json } = await get(path(`q=router&${query}`));

      expect(status, query).toBe(400);
      expect(json, query).toMatchObject({ code: 'validation_failed' });
    }
  });

  it('answers 404 to a signed-in user who is not a member (18)', async () => {
    await signInAs('owner', 'b');

    expect((await get(path('q=router'))).status).toBe(404);
  });

  it('requires a member of the workspace, so a request signed out answers 401 (18)', () => {
    expect(handler.contract.requiredRole).toBe('viewer');
  });
});
