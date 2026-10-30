import { defineEntityRepository } from '@stackmap/extension-sdk/server';

import { proxyRouteSchema } from '../../entities';

import type { ProxyRoute, ProxyRouteFields, ProxyRouteInput, ProxyRoutePatch } from '../../entities';
import type { ReverseProxyDatabase } from '../types/schema';
import type { EntityIssue } from '@stackmap/extension-sdk/entities';
import type { RepositoryContext, ScopedRepository } from '@stackmap/extension-sdk/server';

export type ProxyRouteRepository = ScopedRepository<
  ProxyRoute, ProxyRouteInput, ProxyRoutePatch, { proxyServiceId?: string; upstreamListenerId?: string }
>;

type Context = RepositoryContext<ReverseProxyDatabase>;
type Row = Record<string, unknown>;

/**
 * The proxy is a reverse proxy, and no other route of the proxy serves one of the hostnames. The upstream may be the
 * proxy's own listener, such as Nginx Proxy Manager's admin port.
 */
async function checkRoute(
  { db, scope }: Context, route: ProxyRouteFields, changed: ReadonlySet<string>, id: string,
): Promise<EntityIssue[]> {
  const issues: EntityIssue[] = [];
  const proxyChanged = changed.has('proxyServiceId');
  if (proxyChanged) {
    const proxy = await db.selectFrom('core_service').select(['name', 'kind'])
      .where('workspaceId', '=', scope.workspaceId)
      .where('id', '=', route.proxyServiceId)
      .executeTakeFirst();
    if (proxy && proxy.kind !== 'reverse-proxy') {
      issues.push({ path: 'proxyServiceId', message: `${proxy.name} is not a reverse proxy` });
    }
  }
  if (proxyChanged || changed.has('hostnames')) {
    const taken = new Map((await db.selectFrom('reverse_proxy_routeHostname').select(['hostname', 'routeId'])
      .where('workspaceId', '=', scope.workspaceId)
      .where('proxyServiceId', '=', route.proxyServiceId)
      .where('hostname', 'in', route.hostnames)
      .where('routeId', '!=', id)
      .execute()).map(({ hostname, routeId }) => [hostname, routeId]));
    route.hostnames.forEach((hostname, index) => {
      const other = taken.get(hostname);
      if (other !== undefined) {
        issues.push({ path: `hostnames.${String(index)}`, message: `${hostname} is already served by this proxy, in route ${other}` });
      }
    });
  }
  return issues;
}

/** Replaces the route's hostnames, in their order, with its proxy. */
async function writeHostnames(
  { db, scope, newId }: Context, routeId: string, route: ProxyRouteFields, changed: ReadonlySet<string>,
): Promise<void> {
  if (!changed.has('hostnames') && !changed.has('proxyServiceId')) {
    return;
  }
  await db.deleteFrom('reverse_proxy_routeHostname')
    .where('workspaceId', '=', scope.workspaceId)
    .where('routeId', '=', routeId)
    .execute();
  // Ids are UUIDv7, so ordering by id gives the hostnames back in this order.
  await db.insertInto('reverse_proxy_routeHostname').values(route.hostnames.map((hostname) => ({
    id: newId(),
    workspaceId: scope.workspaceId,
    routeId,
    proxyServiceId: route.proxyServiceId,
    hostname,
  }))).execute();
}

async function withHostnames({ db, scope }: Context, routes: Row[]): Promise<Row[]> {
  const ids = routes.map(({ id }) => id as string);
  const rows = ids.length === 0
    ? []
    : await db.selectFrom('reverse_proxy_routeHostname')
        .select(['routeId', 'hostname'])
        .where('workspaceId', '=', scope.workspaceId)
        .where('routeId', 'in', ids)
        .orderBy('id')
        .execute();
  const byRoute = Map.groupBy(rows, ({ routeId }) => routeId);
  return routes.map((route) => ({
    ...route,
    hostnames: (byRoute.get(route.id as string) ?? []).map(({ hostname }) => hostname),
  }));
}

export const proxyRouteRepository = defineEntityRepository<ProxyRouteFields, ProxyRouteInput, ReverseProxyDatabase>({
  entity: 'route',
  key: 'proxyRoutes',
  table: 'reverse_proxy_route',
  schema: proxyRouteSchema,
  columns: ['proxyServiceId', 'upstreamListenerId', 'forceSsl', 'websockets'],
  ownedFields: ['hostnames'],
  booleans: ['forceSsl', 'websockets'],
  filters: ['proxyServiceId', 'upstreamListenerId'],
  unique: ['hostnames'],
  references: ({ proxyServiceId, upstreamListenerId }) => [
    { field: 'proxyServiceId', table: 'core_service', id: proxyServiceId },
    { field: 'upstreamListenerId', table: 'core_listener', id: upstreamListenerId },
  ],
  dependentsOf: [{ entity: 'listener', column: 'upstreamListenerId' }],
  check: checkRoute,
  writeOwned: writeHostnames,
  expand: withHostnames,
});
