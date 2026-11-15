import { createService } from '@stackmap/extension-core/testing';
import { createProxyRoute } from '@stackmap/extension-reverse-proxy/testing';
import { describe, expect, it } from 'vitest';

import remove from './[extension]/[entity]/[entityId].delete';
import getOne from './[extension]/[entity]/[entityId].get';
import patch from './[extension]/[entity]/[entityId].patch';
import list from './[extension]/[entity]/index.get';
import create from './[extension]/[entity]/index.post';
import { DIALECTS } from '../../../../../tests/support/databases';
import { serveEntities, serveEntity, useEntityApi } from '../../../../../tests/support/entity-api';
import { createPortForwards } from '../../../../../tests/support/nat';
import { listDerivedFlows } from '../../../../repositories/derived-flows';
import { setExtensionsEnabled } from '../../../../repositories/workspace-extensions';

import type { Dialect } from '../../../../../tests/support/databases';

const routes = {
  list: serveEntities('get', list),
  create: serveEntities('post', create),
  get: serveEntity('get', getOne),
  update: serveEntity('patch', patch),
  remove: serveEntity('delete', remove),
};

describe.each(DIALECTS)('entity routes of an extension turned off on %s', (dialect: Dialect) => {
  const { workspaces, db, signInAs, path } = useEntityApi(dialect);
  const turnOff = (...ids: string[]) => setExtensionsEnabled(db(), workspaces.a.workspace.id, ids, false, null);
  const disabled = (extension: string) => expect.objectContaining({ code: 'extension_disabled', extension }) as unknown;

  it('answers 409 extension_disabled to list, create, get, update and delete a port forward with NAT off (18)', async () => {
    const { router, forwards: [forward] } = await createPortForwards(workspaces.a.repos);
    await turnOff('nat');
    await signInAs('owner');
    const body = {
      hostId: router.id, externalAddress: '203.0.113.10', externalPort: 9000, transport: 'tcp',
      internalAddress: '10.0.10.20', internalPort: 9000,
    };

    const answers = [
      await routes.list(path('nat/port-forward')),
      await routes.create(path('nat/port-forward'), { body }),
      await routes.get(path('nat/port-forward', forward?.id)),
      await routes.update(path('nat/port-forward', forward?.id), { body: { description: 'Web' } }),
      await routes.remove(path('nat/port-forward', forward?.id)),
    ];

    expect(answers.map(({ status }) => status)).toEqual([409, 409, 409, 409, 409]);
    for (const { json } of answers) {
      expect(json).toEqual(disabled('nat'));
    }
    expect(await workspaces.a.repos.portForwards.count({})).toBe(2);
  });

  it('answers 409 extension_disabled before parsing the body: an invalid body gets the same answer (18)', async () => {
    await turnOff('nat');
    await signInAs('editor');

    const { status, json } = await routes.create(path('nat/port-forward'), { body: { externalPort: 'not a port', extra: 1 } });

    expect(status).toBe(409);
    expect(json).toEqual(disabled('nat'));
  });

  it('answers 404 workspace_not_found, not 409, to a non-member calling a turned-off type (review)', async () => {
    await turnOff('nat');
    await signInAs('owner', 'b');

    const { status, json } = await routes.create(path('nat/port-forward'), { body: { externalPort: 'not a port' } });

    expect(status).toBe(404);
    expect(json).toMatchObject({ code: 'workspace_not_found' });
  });

  it('answers as before in a workspace where NAT is on', async () => {
    await createPortForwards(workspaces.b.repos);
    await turnOff('nat');
    await signInAs('viewer', 'b');

    const { status } = await routes.list(path('nat/port-forward', undefined, workspaces.b.workspace.id));

    expect(status).toBe(200);
  });

  it('given NAT off then back on, lists every port forward that existed before (19)', async () => {
    const { forwards } = await createPortForwards(workspaces.a.repos);
    await turnOff('nat');
    await setExtensionsEnabled(db(), workspaces.a.workspace.id, ['nat'], true, null);
    await signInAs('viewer');

    const { status, json } = await routes.list(path('nat/port-forward'));

    expect(status).toBe(200);
    expect((json as { items: { id: string }[] }).items.map(({ id }) => id)).toEqual(forwards.map(({ id }) => id));
  });

  it('given reverse proxy off, refuses a service created or changed to kind reverse-proxy with 422 on kind (20)', async () => {
    const app = await createService(workspaces.a.repos, { name: 'Blog' });
    await turnOff('reverse-proxy');
    await signInAs('editor');

    const created = await routes.create(path('core/service'), { body: { name: 'NPM', kind: 'reverse-proxy' } });
    const changed = await routes.update(path('core/service', app.id), { body: { kind: 'reverse-proxy' } });

    for (const { status, json } of [created, changed]) {
      expect(status).toBe(422);
      expect(json).toMatchObject({ code: 'entity_invalid', issues: [expect.objectContaining({ path: 'body.kind' })] });
    }
    expect((await workspaces.a.repos.services.get(app.id))?.kind).toBe('app');
  });

  it('given reverse proxy off, keeps the kind of a service that already has it when its name changes (21)', async () => {
    const proxy = await createService(workspaces.a.repos, { name: 'NPM', kind: 'reverse-proxy' });
    await turnOff('reverse-proxy');
    await signInAs('editor');

    const { status, json } = await routes.update(path('core/service', proxy.id), { body: { name: 'Nginx Proxy Manager' } });

    expect(status).toBe(200);
    expect(json).toMatchObject({ name: 'Nginx Proxy Manager', kind: 'reverse-proxy' });
  });

  it('given reverse proxy off, still answers 409 entity_in_use when a route\'s upstream listener is deleted (22)', async () => {
    const route = await createProxyRoute(workspaces.a.repos);
    await turnOff('reverse-proxy');
    await signInAs('editor');

    const { status, json } = await routes.remove(path('core/listener', route.upstreamListenerId));

    expect(status).toBe(409);
    expect(json).toMatchObject({ code: 'entity_in_use', dependents: [{ extension: 'reverse-proxy', entity: 'route', count: 1 }] });
  });

  it('given NAT off, refuses to delete a host that owns port forwards, keeping both (22b)', async () => {
    const { router } = await createPortForwards(workspaces.a.repos);
    await turnOff('nat');
    await signInAs('editor');

    const { status, json } = await routes.remove(path('core/host', router.id));

    expect(status).toBe(409);
    expect(json).toMatchObject({ code: 'entity_in_use', dependents: [{ extension: 'nat', entity: 'port-forward', count: 2 }] });
    expect(await workspaces.a.repos.hosts.get(router.id)).toBeDefined();
    expect(await workspaces.a.repos.portForwards.count({})).toBe(2);
  });

  it('given NAT on, deletes a host with its port forwards, as before (22b)', async () => {
    const { router } = await createPortForwards(workspaces.a.repos);
    await signInAs('editor');

    expect((await routes.remove(path('core/host', router.id))).status).toBe(204);
    expect(await workspaces.a.repos.portForwards.count({})).toBe(0);
  });

  it('given reverse proxy off, refuses to delete a proxy service that owns routes, keeping both (22b)', async () => {
    const route = await createProxyRoute(workspaces.a.repos);
    await turnOff('reverse-proxy');
    await signInAs('editor');

    const { status, json } = await routes.remove(path('core/service', route.proxyServiceId));

    expect(status).toBe(409);
    expect(json).toMatchObject({ code: 'entity_in_use', dependents: [{ extension: 'reverse-proxy', entity: 'route', count: 1 }] });
    expect(await workspaces.a.repos.proxyRoutes.get(route.id)).toBeDefined();
  });

  it('given NAT off, still updates NAT\'s derived flows when a host\'s address changes (23)', async () => {
    const { router } = await createPortForwards(workspaces.a.repos);
    await turnOff('nat');
    await signInAs('editor');
    const natFlows = async () =>
      (await listDerivedFlows(db(), workspaces.a.workspace.id)).filter(({ extension }) => extension === 'nat');
    expect(await natFlows()).toHaveLength(1);

    const { status } = await routes.update(path('core/host', router.id), { body: { addresses: [{ address: '203.0.113.20' }] } });

    expect(status).toBe(200);
    expect(await natFlows()).toEqual([]);
  });
});
