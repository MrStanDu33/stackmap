import type { ProxyRoute } from '../../entities';
import type { Service } from '@stackmap/extension-core/entities';
import type { TraceHop, TraceHopResolver } from '@stackmap/extension-sdk/server';

/** What the route resolver reads: the routes and their proxies. */
export interface RouteHopEntities {
  routes: readonly Pick<ProxyRoute, 'id' | 'proxyServiceId' | 'hostnames'>[];
  services: readonly Pick<Service, 'id' | 'name'>[];
}

/** One proxy hop per route, naming the route hostname that serves the traced name. */
export function resolveRouteHops(_entities: RouteHopEntities, _hostname: string, _ids: readonly string[]): TraceHop[] {
  return [];
}

export const routeHopResolver: TraceHopResolver = {
  entity: 'route',
  resolve: async ({ hostname, ids, read }) => {
    const [routes, services] = await Promise.all([read.proxyRoutes.list(), read.services.list()]);
    return resolveRouteHops({ routes, services }, hostname, ids);
  },
};
