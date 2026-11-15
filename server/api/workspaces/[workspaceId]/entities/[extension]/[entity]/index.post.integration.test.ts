import { createDomain, createSite } from '@stackmap/extension-core/testing';
import { createApp, createRouter, toWebHandler } from 'h3';
import { describe, expect, it } from 'vitest';

import handler from './index.post';
import { DIALECTS } from '../../../../../../../tests/support/databases';
import { ENTITIES_ROUTE, serveEntities, UNKNOWN_ID, useEntityApi } from '../../../../../../../tests/support/entity-api';
import { serveRoute, TEST_IP } from '../../../../../../../tests/support/requests';
import trafficHandler from '../../../traffic.get';

import type { Dialect } from '../../../../../../../tests/support/databases';

const post = serveEntities('post', handler);
const traffic = serveRoute('get', '/api/workspaces/:workspaceId/traffic', trafficHandler);

describe.each(DIALECTS)('POST /api/workspaces/:workspaceId/entities/:extension/:entity on %s', (dialect: Dialect) => {
  const api = useEntityApi(dialect);

  it('answers 403 forbidden to a viewer and creates nothing (4)', async () => {
    await api.signInAs('viewer');

    const response = await post(api.path('core/site'), { body: { name: 'Home' } });

    expect(response.status).toBe(403);
    expect(response.json).toMatchObject({ code: 'forbidden' });
    expect(await api.workspaces.a.repos.sites.list()).toEqual([]);
  });

  it('lets an editor, an admin and an owner create (5)', async () => {
    for (const role of ['editor', 'admin', 'owner'] as const) {
      await api.signInAs(role);
      expect((await post(api.path('core/site'), { body: { name: `By ${role}` } })).status, role).toBe(201);
    }
    expect((await api.workspaces.a.repos.sites.list()).map(({ name }) => name)).toEqual(['By editor', 'By admin', 'By owner']);
  });

  it('creates with 201, the entity, a Location header and createdBy the caller (15)', async () => {
    const editor = await api.signInAs('editor');

    const response = await post(api.path('core/site'), { body: { name: 'Home', tags: ['main'] } });

    expect(response.status).toBe(201);
    const created = response.json as { id: string };
    expect(created).toMatchObject({ name: 'Home', tags: ['main'], createdBy: editor.user.id, updatedBy: editor.user.id });
    expect(response.headers.get('location')).toBe(api.path('core/site', created.id));
    expect(await api.workspaces.a.repos.sites.get(created.id)).toMatchObject({ name: 'Home' });
  });

  it('answers 422 entity_invalid with every issue\'s path, code, params and message (18)', async () => {
    await api.signInAs('editor');

    const response = await post(api.path('core/host'), {
      body: { name: '', kind: 'physical', addresses: [{ address: '192.0.2.10' }, { address: '192.0.2.10' }] },
    });

    expect(response.status).toBe(422);
    expect(response.json).toMatchObject({
      code: 'entity_invalid',
      issues: [
        { path: 'body.name', code: 'too_small', params: { minimum: 1 }, message: expect.any(String) as string },
        {
          path: 'body.addresses.1.address',
          code: 'core.duplicate-address',
          params: { address: '192.0.2.10' },
          message: '192.0.2.10 is listed twice',
        },
      ],
    });
  });

  it('answers 422, not 500, when an issue would echo more of the input than a Problem holds', async () => {
    await api.signInAs('editor');

    const response = await post(api.path('core/site'), { body: { name: 'Home', customFields: { ['k'.repeat(2000)]: 1 } } });

    expect(response.status).toBe(422);
    const [issue] = (response.json as { issues: { path: string }[] }).issues;
    expect(issue?.path.startsWith('body.customFields.')).toBe(true);
    expect(issue?.path.length).toBeLessThanOrEqual(500);
  });

  it('answers 422 entity_invalid with unknown-kind for a kind no active extension provides (18, 27)', async () => {
    await api.signInAs('editor');

    const response = await post(api.path('core/host'), { body: { name: 'nas', kind: 'mainframe' } });

    expect(response.status).toBe(422);
    expect(response.json).toMatchObject({
      code: 'entity_invalid',
      issues: [{ path: 'body.kind', code: 'unknown-kind', params: { entity: 'host', kind: 'mainframe' } }],
    });
  });

  it('answers 422 reference_invalid naming the field for a reference to another workspace or nowhere (19)', async () => {
    const elsewhere = await createSite(api.workspaces.b.repos);
    await api.signInAs('editor');

    for (const siteId of [elsewhere.id, UNKNOWN_ID]) {
      const response = await post(api.path('core/host'), { body: { name: 'nas', kind: 'physical', siteId } });
      expect(response.status).toBe(422);
      expect(response.json).toMatchObject({ code: 'reference_invalid', field: 'siteId' });
    }
    expect(await api.workspaces.a.repos.hosts.list()).toEqual([]);
  });

  it('answers 409 entity_conflict naming the fields for a duplicate unique value (20)', async () => {
    await createDomain(api.workspaces.a.repos, { name: 'homelab.example' });
    await api.signInAs('editor');

    const response = await post(api.path('core/domain'), { body: { name: 'homelab.example' } });

    expect(response.status).toBe(409);
    expect(response.json).toMatchObject({ code: 'entity_conflict', fields: ['name'] });
  });

  it('answers 400 validation_failed for id, workspaceId, createdAt or an undeclared field in the body (24)', async () => {
    await api.signInAs('editor');

    for (const extra of [{ id: UNKNOWN_ID }, { workspaceId: UNKNOWN_ID }, { createdAt: '2026-11-14T09:00:00.000Z' }, { color: 'red' }]) {
      const response = await post(api.path('core/site'), { body: { name: 'Home', ...extra } });
      expect(response.status, Object.keys(extra)[0]).toBe(400);
      expect(response.json).toMatchObject({ code: 'validation_failed' });
    }
    expect(await api.workspaces.a.repos.sites.list()).toEqual([]);
  });

  it('answers 413 for a body over 1 MiB and 415 for a non-JSON body', async () => {
    await api.signInAs('editor');
    const app = toWebHandler(createApp().use(createRouter().post(ENTITIES_ROUTE, handler)));

    const tooLarge = await post(api.path('core/site'), { body: { name: 'Home', notes: 'x'.repeat(1024 * 1024) } });
    const notJson = await app(new Request(`http://localhost${api.path('core/site')}`, {
      method: 'POST', headers: { 'content-type': 'text/plain', 'x-forwarded-for': TEST_IP }, body: 'name=Home',
    }));

    expect(tooLarge.status).toBe(413);
    expect(notJson.status).toBe(415);
    expect(await api.workspaces.a.repos.sites.list()).toEqual([]);
  });

  it('lets one of two concurrent creates with the same unique value through and answers 409 to the other', async () => {
    await api.signInAs('editor');

    const responses = await Promise.all([1, 2].map(() =>
      post(api.path('core/domain'), { body: { name: 'homelab.example' } })));

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
  });

  it('creates a host with its addresses in one body', async () => {
    await api.signInAs('editor');

    const response = await post(api.path('core/host'), {
      body: { name: 'nas', kind: 'physical', addresses: [{ address: '192.0.2.10' }, { address: '2001:db8::10' }] },
    });

    expect(response.status).toBe(201);
    expect(response.json).toMatchObject({
      addresses: [{ address: '192.0.2.10', networkId: null }, { address: '2001:db8::10', networkId: null }],
    });
  });

  it('refreshes the derived flows: a DNS record written through the API shows in the traffic (34)', async () => {
    const workspace = api.workspaces.a.workspace;
    await api.signInAs('editor');
    const domain = (await post(api.path('core/domain'), { body: { name: 'homelab.example' } })).json as { id: string };
    const host = (await post(api.path('core/host'), {
      body: { name: 'web', kind: 'vm', addresses: [{ address: '192.0.2.20' }] },
    })).json as { id: string };
    const service = (await post(api.path('core/service'), { body: { name: 'blog', kind: 'app', hostId: host.id } })).json as { id: string };
    await post(api.path('core/listener'), { body: { serviceId: service.id, port: 443, transport: 'tcp', protocol: 'https' } });

    await post(api.path('core/dns-record'), {
      body: { domainId: domain.id, name: 'blog', type: 'A', value: '192.0.2.20' },
    });

    const flows = ((await traffic(`/api/workspaces/${workspace.id}/traffic`)).json as { flows: { hostnames: string[] }[] }).flows;
    expect(flows.flatMap(({ hostnames }) => hostnames)).toContain('blog.homelab.example');
  });
});
