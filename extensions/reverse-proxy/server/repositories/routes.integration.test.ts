import { describe, expect, it } from 'vitest';

import { isForeignKeyViolation } from '../../../../server/database/errors';
import { newId } from '../../../../server/database/ids';
import { createWorkspaceRepositories } from '../../../../server/repositories';
import {
  EntityConflictError, EntityInUseError, EntityValidationError, WorkspaceReferenceError,
} from '../../../../server/repositories/errors';
import { DIALECTS } from '../../../../tests/support/databases';
import { describeScopedRepository } from '../../../../tests/support/scoped-repository-suite';
import { BUILTIN_KINDS, BUILTIN_REGISTRY, countRows, useTestWorkspaces } from '../../../../tests/support/workspaces';
import { buildListener, createListener, createService } from '../../../core/testing';
import { buildProxyRoute, createProxyRoute } from '../../testing';

import type { ProxyRouteRepository } from './routes';
import type { WorkspaceRepositories } from '../../../../server/repositories';
import type { Dialect } from '../../../../tests/support/databases';

const createProxy = (repos: WorkspaceRepositories, name = 'Nginx Proxy Manager') =>
  createService(repos, { name, kind: 'reverse-proxy' });

describe.each(DIALECTS)('proxy routes on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const routes = (): ProxyRouteRepository => workspaces.a.repos.proxyRoutes;

  describeScopedRepository({
    workspaces,
    repository: 'proxyRoutes',
    table: 'reverse_proxy_route',
    input: async (repos: WorkspaceRepositories) => buildProxyRoute({
      proxyServiceId: (await createProxy(repos)).id,
      upstreamListenerId: (await createListener(repos)).id,
    }),
    patch: { forceSsl: true, websockets: true },
    invalid: { input: { hostnames: [], forceSsl: 'yes' }, paths: ['hostnames', 'forceSsl'] },
  });

  it('creates a route and returns it with its hostnames in order, from create, get and list', async () => {
    const { repos } = workspaces.a;
    const proxy = await createProxy(repos);
    const upstream = await createListener(repos, { port: 3000 });

    const route = await routes().create({
      proxyServiceId: proxy.id,
      hostnames: ['www.homelab.example', 'homelab.example', 'app.homelab.example'],
      upstreamListenerId: upstream.id,
    });

    expect(route).toMatchObject({
      proxyServiceId: proxy.id,
      hostnames: ['www.homelab.example', 'homelab.example', 'app.homelab.example'],
      upstreamListenerId: upstream.id,
      forceSsl: false,
      websockets: false,
    });
    expect(await routes().get(route.id)).toEqual(route);
    expect(await routes().list()).toEqual([route]);
  });

  it('given a proxy service whose kind is not reverse-proxy, refuses the route on create or move, with an issue on proxyServiceId naming the service', async () => {
    const { repos } = workspaces.a;
    const app = await createService(repos, { name: 'Website', kind: 'app' });
    const route = await createProxyRoute(repos);
    const refused = {
      constructor: EntityValidationError,
      issues: [{ path: 'proxyServiceId', message: expect.stringContaining('Website') as unknown }],
    };

    const onApp = buildProxyRoute({ proxyServiceId: app.id, upstreamListenerId: route.upstreamListenerId });

    await expect(routes().create(onApp)).rejects.toMatchObject(refused);
    await expect(routes().update(route.id, { proxyServiceId: app.id })).rejects.toMatchObject(refused);
    expect(await routes().get(route.id)).toMatchObject({ proxyServiceId: route.proxyServiceId });
  });

  it('given a hostname another route of the same proxy serves, refuses it on create, update or move, naming the other route', async () => {
    const { repos } = workspaces.a;
    const proxy = await createProxy(repos);
    const other = await createProxy(repos, 'Traefik');
    await createProxyRoute(repos, { proxyServiceId: proxy.id, hostnames: ['homelab.example', 'app.homelab.example'] });
    const second = await createProxyRoute(repos, { proxyServiceId: proxy.id, hostnames: ['www.homelab.example'] });
    const elsewhere = await createProxyRoute(repos, { proxyServiceId: other.id, hostnames: ['app.homelab.example'] });
    const taken = (index: number) => ({
      constructor: EntityValidationError,
      issues: [{ path: `hostnames.${String(index)}`, message: expect.stringContaining('homelab.example') as unknown }],
    });

    await expect(createProxyRoute(repos, { proxyServiceId: proxy.id, hostnames: ['new.homelab.example', 'APP.homelab.example'] }))
      .rejects.toMatchObject(taken(1));
    await expect(routes().update(second.id, { hostnames: ['homelab.example'] })).rejects.toMatchObject(taken(0));
    await expect(routes().update(elsewhere.id, { proxyServiceId: proxy.id })).rejects.toMatchObject(taken(0));
    expect(await routes().get(second.id)).toMatchObject({ hostnames: ['www.homelab.example'] });
  });

  it('accepts the same hostname on another proxy', async () => {
    const { repos } = workspaces.a;
    await createProxyRoute(repos, { hostnames: ['app.homelab.example'] });

    expect(await createProxyRoute(repos, { hostnames: ['app.homelab.example'] })).toMatchObject({ hostnames: ['app.homelab.example'] });
  });

  it('given two concurrent writes claiming one hostname on one proxy, lets exactly one succeed', async () => {
    const { a, db } = workspaces;
    const proxy = await createProxy(a.repos);
    await createProxyRoute(a.repos, { proxyServiceId: proxy.id, hostnames: ['app.homelab.example'] });
    // The other write committed after this one's check read the hostnames: the check sees nothing, the index refuses.
    const routeDefinition = BUILTIN_REGISTRY.repositories().find(({ key }) => key === 'proxyRoutes');
    const racing = { ...routeDefinition, check: () => Promise.resolve([]) };
    const listeners = BUILTIN_REGISTRY.repositories().filter(({ key }) => key !== 'proxyRoutes');
    const repos = createWorkspaceRepositories([...listeners, racing] as never)(db, {
      workspaceId: a.workspace.id, actorId: null, kinds: BUILTIN_KINDS,
    });

    await expect(repos.proxyRoutes.create(buildProxyRoute({
      proxyServiceId: proxy.id,
      hostnames: ['app.homelab.example'],
      upstreamListenerId: (await createListener(a.repos)).id,
    }))).rejects.toMatchObject({ constructor: EntityConflictError, fields: ['hostnames'] });
    expect(await countRows(db, 'reverse_proxy_route', a.workspace.id)).toBe(1);
  });

  it('given an update of forceSsl only, keeps the hostnames rows; given new hostnames, replaces them in the new order', async () => {
    const { a, db } = workspaces;
    const route = await createProxyRoute(a.repos, { hostnames: ['homelab.example', 'www.homelab.example'] });
    const hostnameIds = () => db.selectFrom('reverse_proxy_routeHostname').select('id').where('routeId', '=', route.id)
      .orderBy('id').execute();
    const before = await hostnameIds();

    await routes().update(route.id, { forceSsl: true });
    expect(await hostnameIds()).toEqual(before);

    expect(await routes().update(route.id, { hostnames: ['www.homelab.example', 'app.homelab.example'] }))
      .toMatchObject({ forceSsl: true, hostnames: ['www.homelab.example', 'app.homelab.example'] });
  });

  it('lists the routes of a proxy service, or of an upstream listener', async () => {
    const { repos } = workspaces.a;
    const first = await createProxyRoute(repos);
    const second = await createProxyRoute(repos, { upstreamListenerId: first.upstreamListenerId });

    expect((await routes().list({ proxyServiceId: second.proxyServiceId })).map(({ id }) => id)).toEqual([second.id]);
    expect((await routes().list({ upstreamListenerId: first.upstreamListenerId })).map(({ id }) => id))
      .toEqual([first.id, second.id]);
  });

  it('given a removed proxy service, removes its routes and their hostnames', async () => {
    const { a, db } = workspaces;
    const route = await createProxyRoute(a.repos);
    await createProxyRoute(a.repos);

    expect(await a.repos.services.remove(route.proxyServiceId)).toBe(true);

    expect(await routes().get(route.id)).toBeUndefined();
    expect(await countRows(db, 'reverse_proxy_route', a.workspace.id)).toBe(1);
    expect(await countRows(db, 'reverse_proxy_routeHostname', a.workspace.id)).toBe(1);
  });

  it('given a listener that is a route\'s upstream, refuses removing it, naming the proxy route, until the route points elsewhere', async () => {
    const { repos } = workspaces.a;
    const route = await createProxyRoute(repos);
    const other = await repos.listeners.create(buildListener({ serviceId: (await createService(repos)).id }));

    await expect(repos.listeners.remove(route.upstreamListenerId))
      .rejects.toMatchObject({ constructor: EntityInUseError, dependents: [{ entity: 'route', count: 1 }] });

    await routes().update(route.id, { upstreamListenerId: other.id });
    expect(await repos.listeners.remove(route.upstreamListenerId)).toBe(true);
  });
  it('given a proxy or upstream of another workspace, fails with a reference error on that field and writes nothing', async () => {
    const { a, b, db } = workspaces;
    const route = await createProxyRoute(a.repos);
    const theirs = await createProxyRoute(b.repos);
    const cases = [
      { field: 'proxyServiceId', id: theirs.proxyServiceId },
      { field: 'upstreamListenerId', id: theirs.upstreamListenerId },
    ];

    for (const { field, id } of cases) {
      const refused = { constructor: WorkspaceReferenceError, field, id };
      const { proxyServiceId, upstreamListenerId } = route;
      await expect(routes().create(buildProxyRoute({ proxyServiceId, upstreamListenerId, [field]: id })))
        .rejects.toMatchObject(refused);
      await expect(routes().update(route.id, { [field]: id })).rejects.toMatchObject(refused);
    }
    expect(await countRows(db, 'reverse_proxy_route', a.workspace.id)).toBe(1);
    expect(await routes().get(route.id)).toEqual(route);
  });

  it('given direct writes that pair the workspace with another workspace\'s service, listener or route, the database refuses them', async () => {
    const { a, b, db } = workspaces;
    const route = await createProxyRoute(a.repos);
    const theirs = await createProxyRoute(b.repos);

    await expect(db.updateTable('reverse_proxy_route').set({ proxyServiceId: theirs.proxyServiceId })
      .where('id', '=', route.id).execute()).rejects.toSatisfy(isForeignKeyViolation);
    await expect(db.updateTable('reverse_proxy_route').set({ upstreamListenerId: theirs.upstreamListenerId })
      .where('id', '=', route.id).execute()).rejects.toSatisfy(isForeignKeyViolation);
    await expect(db.insertInto('reverse_proxy_routeHostname').values({
      id: newId(),
      workspaceId: a.workspace.id,
      routeId: theirs.id,
      proxyServiceId: theirs.proxyServiceId,
      hostname: 'stray.homelab.example',
    }).execute()).rejects.toSatisfy(isForeignKeyViolation);
  });

  it('given a direct write of a hostname row on another proxy than its route\'s, the database refuses it', async () => {
    const { a, db } = workspaces;
    const route = await createProxyRoute(a.repos);
    const other = await createProxy(a.repos, 'Traefik');

    await expect(db.updateTable('reverse_proxy_routeHostname').set({ proxyServiceId: other.id })
      .where('routeId', '=', route.id).execute()).rejects.toSatisfy(isForeignKeyViolation);
  });

  it('given a service whose listener is a route\'s upstream, refuses removing it, naming the proxy route', async () => {
    const { repos } = workspaces.a;
    const route = await createProxyRoute(repos);
    const upstream = await repos.listeners.get(route.upstreamListenerId);

    await expect(repos.services.remove(upstream!.serviceId))
      .rejects.toMatchObject({ constructor: EntityInUseError, dependents: [{ entity: 'route', count: 1 }] });
    expect(await repos.services.get(upstream!.serviceId)).toBeDefined();
  });

  it('given a proxy whose route forwards to the proxy\'s own listener, removes the proxy with the route and listener', async () => {
    const { repos } = workspaces.a;
    const proxy = await createProxy(repos);
    const admin = await createListener(repos, { serviceId: proxy.id, port: 81 });
    const route = await createProxyRoute(repos, { proxyServiceId: proxy.id, upstreamListenerId: admin.id });

    expect(await repos.services.remove(proxy.id)).toBe(true);

    expect(await routes().get(route.id)).toBeUndefined();
    expect(await repos.listeners.get(admin.id)).toBeUndefined();
  });
});
