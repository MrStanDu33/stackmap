import { createHost, createListener, createSite } from '@stackmap/extension-core/testing';
import { describe, expect, it } from 'vitest';

import handler from './index.get';
import { DIALECTS } from '../../../../../../../tests/support/databases';
import { serveEntities, UNKNOWN_ID, useEntityApi } from '../../../../../../../tests/support/entity-api';
import { setSessionResolver } from '../../../../../../utils/session';

import type { Dialect } from '../../../../../../../tests/support/databases';

const get = serveEntities('get', handler);

interface Page {
  items: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
}

describe.each(DIALECTS)('GET /api/workspaces/:workspaceId/entities/:extension/:entity on %s', (dialect: Dialect) => {
  const api = useEntityApi(dialect);

  it('lets a viewer list entities (3)', async () => {
    await createSite(api.workspaces.a.repos, { name: 'Home' });
    await api.signInAs('viewer');

    const response = await get(api.path('core/site'));

    expect(response.status).toBe(200);
    expect((response.json as Page).items.map(({ name }) => name)).toEqual(['Home']);
  });

  it('answers 404 workspace_not_found to a non-member or an unknown workspace before reading the input (6)', async () => {
    await api.signInAs('owner', 'b');

    for (const workspaceId of [api.workspaces.a.workspace.id, UNKNOWN_ID]) {
      const response = await get(`${api.path('core/site', undefined, workspaceId)}?limit=not-a-number`);
      expect(response.status).toBe(404);
      expect(response.json).toMatchObject({ code: 'workspace_not_found' });
    }
  });

  it('answers 401 without a session before reading the input (7)', async () => {
    setSessionResolver(() => Promise.resolve(null));

    const response = await get(`${api.path('core/site')}?limit=not-a-number`);

    expect(response.status).toBe(401);
    expect(response.json).toMatchObject({ code: 'unauthenticated' });
  });

  it('answers 404 entity_type_not_found for an extension or entity no active extension declares (8)', async () => {
    await api.signInAs('owner');

    for (const type of ['nope/site', 'core/nope', 'core/hosts', 'reverse-proxy/host']) {
      const response = await get(api.path(type));
      expect(response.status, type).toBe(404);
      expect(response.json, type).toMatchObject({ code: 'entity_type_not_found' });
    }
  });

  it('lists only the workspace\'s entities, in creation order (10)', async () => {
    for (const name of ['Home', 'Office', 'Colo']) {
      await createSite(api.workspaces.a.repos, { name });
    }
    await createSite(api.workspaces.b.repos, { name: 'Elsewhere' });
    await api.signInAs('viewer');

    const { items } = (await get(api.path('core/site'))).json as Page;

    expect(items.map(({ name }) => name)).toEqual(['Home', 'Office', 'Colo']);
  });

  it('pages with limit and offset and gives the total after filters; defaults to 100 from 0 (11)', async () => {
    const site = await createSite(api.workspaces.a.repos);
    for (let index = 0; index < 5; index += 1) {
      await createHost(api.workspaces.a.repos, { name: `host-${String(index)}`, siteId: index < 4 ? site.id : null });
    }
    await api.signInAs('viewer');

    const page = (await get(`${api.path('core/host')}?siteId=${site.id}&limit=2&offset=1`)).json as Page;
    const defaults = (await get(api.path('core/host'))).json as Page;

    expect(page.items.map(({ name }) => name)).toEqual(['host-1', 'host-2']);
    expect(page).toMatchObject({ total: 4, limit: 2, offset: 1 });
    expect(defaults).toMatchObject({ total: 5, limit: 100, offset: 0 });
    expect(defaults.items).toHaveLength(5);
  });

  it('refuses a limit outside 1-1,000 or an offset outside 0-1,000,000 with 400, and gives empty items past the end (11)', async () => {
    await createSite(api.workspaces.a.repos);
    await api.signInAs('viewer');

    for (const query of ['limit=0', 'limit=1001', 'offset=-1', 'offset=1000001', 'limit=1.5']) {
      const response = await get(`${api.path('core/site')}?${query}`);
      expect(response.status, query).toBe(400);
      expect(response.json, query).toMatchObject({ code: 'validation_failed' });
    }
    expect((await get(`${api.path('core/site')}?offset=10`)).json).toEqual({ items: [], total: 1, limit: 100, offset: 10 });
  });

  it('filters on the repository\'s declared filters and refuses an unknown or malformed query parameter with 400 (12)', async () => {
    const service = (await createListener(api.workspaces.a.repos)).serviceId;
    await createListener(api.workspaces.a.repos);
    await api.signInAs('viewer');

    const filtered = (await get(`${api.path('core/listener')}?serviceId=${service}`)).json as Page;

    expect(filtered.items.map(({ serviceId }) => serviceId)).toEqual([service]);
    for (const query of ['hostId=' + UNKNOWN_ID, 'serviceId=not-a-uuid', 'name=web']) {
      expect((await get(`${api.path('core/listener')}?${query}`)).status, query).toBe(400);
    }
  });

  it('returns the entity fields and meta, never workspaceId or an undeclared column (14)', async () => {
    const host = await createHost(api.workspaces.a.repos, { name: 'nas', addresses: [{ address: '192.0.2.10' }] });
    const member = await api.signInAs('viewer');

    const [item] = ((await get(api.path('core/host'))).json as Page).items;

    expect(Object.keys(item ?? {}).sort()).toEqual([
      'addresses', 'createdAt', 'createdBy', 'customFields', 'externalRef', 'id', 'kind', 'links', 'name', 'notes',
      'origin', 'os', 'siteId', 'status', 'tags', 'updatedAt', 'updatedBy',
    ]);
    expect(item).toMatchObject({
      id: host.id, createdAt: host.createdAt.toISOString(), addresses: [{ address: '192.0.2.10', networkId: null }],
    });
    expect(member.user.id).not.toBe(item?.createdBy);
  });

  it('routes extensions and entities with dashes (reverse-proxy routes, core dns-record)', async () => {
    await api.signInAs('viewer');

    for (const type of ['reverse-proxy/route', 'core/dns-record', 'nat/port-forward']) {
      const response = await get(api.path(type));
      expect(response.status, type).toBe(200);
      expect(response.json, type).toEqual({ items: [], total: 0, limit: 100, offset: 0 });
    }
  });
});
