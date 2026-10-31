import { servesHostname } from '@stackmap/extension-sdk/server';

import type { ProxyRoute } from '../../entities';
import type { Service } from '@stackmap/extension-core/entities';
import type { TraceHop, TraceHopResolver } from '@stackmap/extension-sdk/server';

/** What the route resolver reads: the routes and their proxies. */
export interface RouteHopEntities {
  routes: readonly Pick<ProxyRoute, 'id' | 'proxyServiceId' | 'hostnames'>[];
  services: readonly Pick<Service, 'id' | 'name'>[];
}

/** One proxy hop per route, naming the route hostname that serves the traced name. */
export function resolveRouteHops(
  { routes, services }: RouteHopEntities,
  hostname: string,
  ids: readonly string[],
): TraceHop[] {
  const given = new Set(ids);
  const serviceNames = new Map(services.map(({ id, name }) => [id, name]));
  // A route whose proxy is gone (references normally prevent it) has nothing to say: no hop.
  return routes.filter(({ id, proxyServiceId }) => given.has(id) && serviceNames.has(proxyServiceId)).map((route) => ({
    entity: 'route',
    id: route.id,
    stage: 'proxy',
    label: 'extensions.reverse-proxy.trace.route',
    params: {
      proxy: serviceNames.get(route.proxyServiceId) ?? '',
      hostname: route.hostnames.includes(hostname)
        ? hostname
        : route.hostnames.find((name) => servesHostname(name, hostname)) ?? hostname,
    },
  }));
}

export const routeHopResolver: TraceHopResolver = {
  entity: 'route',
  resolve: async ({ hostname, ids, read }) => {
    const [routes, services] = await Promise.all([read.proxyRoutes.list(), read.services.list()]);
    return resolveRouteHops({ routes, services }, hostname, ids);
  },
};
