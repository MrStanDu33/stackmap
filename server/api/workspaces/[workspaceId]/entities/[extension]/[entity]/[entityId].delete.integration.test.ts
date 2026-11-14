import { createHost, createService, createSite } from '@stackmap/extension-core/testing';
import { describe, expect, it } from 'vitest';

import handler from './[entityId].delete';
import { DIALECTS } from '../../../../../../../tests/support/databases';
import { serveEntity, UNKNOWN_ID, useEntityApi } from '../../../../../../../tests/support/entity-api';

import type { Dialect } from '../../../../../../../tests/support/databases';

const remove = serveEntity('delete', handler);

describe.each(DIALECTS)('DELETE /api/workspaces/:workspaceId/entities/:extension/:entity/:entityId on %s', (dialect: Dialect) => {
  const api = useEntityApi(dialect);

  it('answers 403 forbidden to a viewer and removes nothing (4)', async () => {
    const site = await createSite(api.workspaces.a.repos);
    await api.signInAs('viewer');

    expect((await remove(api.path('core/site', site.id))).status).toBe(403);
    expect(await api.workspaces.a.repos.sites.get(site.id)).toBeDefined();
  });

  it('lets an editor remove (5)', async () => {
    const site = await createSite(api.workspaces.a.repos);
    await api.signInAs('editor');

    expect((await remove(api.path('core/site', site.id))).status).toBe(204);
  });

  it('answers 404 entity_not_found for an entity of another workspace, none, or a malformed id (13)', async () => {
    const elsewhere = await createSite(api.workspaces.b.repos);
    await api.signInAs('editor');

    for (const id of [elsewhere.id, UNKNOWN_ID, 'not-an-id']) {
      const response = await remove(api.path('core/site', id));
      expect(response.status, id).toBe(404);
      expect(response.json, id).toMatchObject({ code: 'entity_not_found' });
    }
    expect(await api.workspaces.b.repos.sites.get(elsewhere.id)).toBeDefined();
  });

  it('removes an entity nothing refers to with 204 (17)', async () => {
    const site = await createSite(api.workspaces.a.repos);
    await api.signInAs('editor');

    const response = await remove(api.path('core/site', site.id));

    expect(response.status).toBe(204);
    expect(response.json).toBeUndefined();
    expect(await api.workspaces.a.repos.sites.get(site.id)).toBeUndefined();
  });

  it('answers 409 entity_in_use listing each dependent\'s extension, entity and count (21)', async () => {
    const host = await createHost(api.workspaces.a.repos);
    await createService(api.workspaces.a.repos, { hostId: host.id });
    await createService(api.workspaces.a.repos, { hostId: host.id });
    await api.signInAs('editor');

    const response = await remove(api.path('core/host', host.id));

    expect(response.status).toBe(409);
    expect(response.json).toMatchObject({
      code: 'entity_in_use', dependents: [{ extension: 'core', entity: 'service', count: 2 }],
    });
    expect(await api.workspaces.a.repos.hosts.get(host.id)).toBeDefined();
  });
});
