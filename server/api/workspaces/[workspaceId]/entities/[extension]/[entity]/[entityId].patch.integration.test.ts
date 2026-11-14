import { createDomain, createHost, createSite } from '@stackmap/extension-core/testing';
import { describe, expect, it } from 'vitest';

import handler from './[entityId].patch';
import { DIALECTS } from '../../../../../../../tests/support/databases';
import { serveEntity, UNKNOWN_ID, useEntityApi } from '../../../../../../../tests/support/entity-api';
import { BUILTIN_EXTENSION_SERVERS, BUILTIN_EXTENSIONS } from '../../../../../../extensions/builtin';
import { createExtensionRegistry } from '../../../../../../extensions/registry';
import { setExtensionRegistry } from '../../../../../../utils/extensions';

import type { Dialect } from '../../../../../../../tests/support/databases';

const patch = serveEntity('patch', handler);

describe.each(DIALECTS)('PATCH /api/workspaces/:workspaceId/entities/:extension/:entity/:entityId on %s', (dialect: Dialect) => {
  const api = useEntityApi(dialect);

  it('answers 403 forbidden to a viewer and changes nothing (4)', async () => {
    const site = await createSite(api.workspaces.a.repos, { name: 'Home' });
    await api.signInAs('viewer');

    const response = await patch(api.path('core/site', site.id), { body: { name: 'Office' } });

    expect(response.status).toBe(403);
    expect(await api.workspaces.a.repos.sites.get(site.id)).toMatchObject({ name: 'Home' });
  });

  it('lets an editor update (5)', async () => {
    const site = await createSite(api.workspaces.a.repos, { name: 'Home' });
    await api.signInAs('editor');

    const response = await patch(api.path('core/site', site.id), { body: { name: 'Office' } });

    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({ id: site.id, name: 'Office' });
  });

  it('answers 404 entity_not_found for an entity of another workspace, none, or a malformed id (13)', async () => {
    const elsewhere = await createSite(api.workspaces.b.repos, { name: 'Elsewhere' });
    await api.signInAs('editor');

    for (const id of [elsewhere.id, UNKNOWN_ID, 'not-an-id']) {
      const response = await patch(api.path('core/site', id), { body: { name: 'Mine now' } });
      expect(response.status, id).toBe(404);
      expect(response.json, id).toMatchObject({ code: 'entity_not_found' });
    }
    expect(await api.workspaces.b.repos.sites.get(elsewhere.id)).toMatchObject({ name: 'Elsewhere' });
  });

  it('updates only the given fields, with updatedBy the caller (16)', async () => {
    const host = await createHost(api.workspaces.a.repos, { name: 'nas', os: 'Debian 12', tags: ['storage'] });
    const editor = await api.signInAs('editor');

    const response = await patch(api.path('core/host', host.id), { body: { os: 'Debian 13' } });

    expect(response.json).toMatchObject({
      name: 'nas', os: 'Debian 13', tags: ['storage'], updatedBy: editor.user.id, createdBy: host.createdBy,
    });
  });

  it('answers 422 entity_invalid, 422 reference_invalid and 409 entity_conflict like create (18, 19, 20)', async () => {
    const host = await createHost(api.workspaces.a.repos);
    await createDomain(api.workspaces.a.repos, { name: 'homelab.example' });
    const domain = await createDomain(api.workspaces.a.repos, { name: 'lab.example' });
    await api.signInAs('editor');

    const invalid = await patch(api.path('core/host', host.id), { body: { name: '' } });
    const reference = await patch(api.path('core/host', host.id), { body: { siteId: UNKNOWN_ID } });
    const conflict = await patch(api.path('core/domain', domain.id), { body: { name: 'homelab.example' } });

    expect(invalid).toMatchObject({ status: 422, json: { code: 'entity_invalid', issues: [{ path: 'body.name', code: 'too_small' }] } });
    expect(reference).toMatchObject({ status: 422, json: { code: 'reference_invalid', field: 'siteId' } });
    expect(conflict).toMatchObject({ status: 409, json: { code: 'entity_conflict', fields: ['name'] } });
  });

  it('answers 409 entity_changed when the entity changed since the update read it (22)', async () => {
    const site = await createSite(api.workspaces.a.repos);
    await api.signInAs('editor');
    // Another write lands between the update's read and its write.
    setExtensionRegistry(createExtensionRegistry(BUILTIN_EXTENSIONS, {
      servers: BUILTIN_EXTENSION_SERVERS.map((server) => ({
        ...server,
        repositories: server.repositories?.map((definition) => (definition.key !== 'sites'
          ? definition
          : {
              ...definition,
              check: async () => {
                await api.workspaces.db.updateTable('core_site').set({ updatedAt: '2030-01-01T00:00:00.000Z' })
                  .where('id', '=', site.id).execute();
                return [];
              },
            })),
      })),
    }));

    const response = await patch(api.path('core/site', site.id), { body: { name: 'Office' } });

    expect(response.status).toBe(409);
    expect(response.json).toMatchObject({ code: 'entity_changed' });
  });

  it('answers 400 validation_failed for a meta or undeclared field in the body (24)', async () => {
    const site = await createSite(api.workspaces.a.repos);
    await api.signInAs('editor');

    for (const body of [{ id: UNKNOWN_ID }, { updatedAt: '2026-11-14T09:00:00.000Z' }, { color: 'red' }]) {
      expect((await patch(api.path('core/site', site.id), { body })).status, Object.keys(body)[0]).toBe(400);
    }
  });

  it('answers 200 unchanged to an empty body', async () => {
    const site = await createSite(api.workspaces.a.repos, { name: 'Home' });
    await api.signInAs('editor');

    const response = await patch(api.path('core/site', site.id), { body: {} });

    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({ name: 'Home', updatedAt: site.updatedAt.toISOString() });
  });

  it('sets a nullable field to null when given null and keeps it when omitted', async () => {
    const host = await createHost(api.workspaces.a.repos, { name: 'nas', os: 'Debian 13' });
    await api.signInAs('editor');

    const kept = await patch(api.path('core/host', host.id), { body: { name: 'storage' } });
    const cleared = await patch(api.path('core/host', host.id), { body: { os: null } });

    expect(kept.json).toMatchObject({ name: 'storage', os: 'Debian 13' });
    expect(cleared.json).toMatchObject({ name: 'storage', os: null });
  });
});
