import { createHost, createSite } from '@stackmap/extension-core/testing';
import { describe, expect, it } from 'vitest';

import handler from './[entityId].get';
import { DIALECTS } from '../../../../../../../tests/support/databases';
import { serveEntity, UNKNOWN_ID, useEntityApi } from '../../../../../../../tests/support/entity-api';

import type { Dialect } from '../../../../../../../tests/support/databases';

const get = serveEntity('get', handler);

describe.each(DIALECTS)('GET /api/workspaces/:workspaceId/entities/:extension/:entity/:entityId on %s', (dialect: Dialect) => {
  const api = useEntityApi(dialect);

  it('lets a viewer read an entity (3)', async () => {
    const site = await createSite(api.workspaces.a.repos, { name: 'Home' });
    await api.signInAs('viewer');

    const response = await get(api.path('core/site', site.id));

    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({ id: site.id, name: 'Home' });
  });

  it('answers 404 entity_not_found for an entity of another workspace, none, or a malformed id (13)', async () => {
    const elsewhere = await createSite(api.workspaces.b.repos);
    const host = await createHost(api.workspaces.a.repos);
    await api.signInAs('viewer');

    // A host's id is no site's: the type is part of the address.
    for (const id of [elsewhere.id, UNKNOWN_ID, 'not-an-id', host.id]) {
      const response = await get(api.path('core/site', id));
      expect(response.status, id).toBe(404);
      expect(response.json, id).toMatchObject({ code: 'entity_not_found' });
    }
  });

  it('returns the entity fields and meta, never workspaceId or an undeclared column (14)', async () => {
    const site = await createSite(api.workspaces.a.repos, { name: 'Home' });
    await api.signInAs('viewer');

    const body = (await get(api.path('core/site', site.id))).json as Record<string, unknown>;

    expect(Object.keys(body).sort()).toEqual([
      'createdAt', 'createdBy', 'customFields', 'externalRef', 'id', 'links', 'name', 'notes', 'origin', 'status', 'tags',
      'updatedAt', 'updatedBy',
    ]);
    expect(body).toMatchObject({ createdAt: site.createdAt.toISOString(), updatedAt: site.updatedAt.toISOString() });
  });
});
