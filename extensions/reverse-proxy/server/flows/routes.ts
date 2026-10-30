import type { ProxyRoute } from '../../entities';
import type { FlowDeriver, FlowDraft } from '@stackmap/extension-sdk/server';

/** One flow per route: from the proxy to its upstream, for the route's hostnames. */
export function deriveRouteFlows(
  routes: readonly Pick<ProxyRoute, 'id' | 'proxyServiceId' | 'upstreamListenerId' | 'hostnames'>[],
): FlowDraft[] {
  return routes.map(({ id, proxyServiceId, upstreamListenerId, hostnames }) => ({
    key: id,
    source: { serviceId: proxyServiceId },
    targetListenerId: upstreamListenerId,
    hostnames,
    basis: [{ entity: 'route', id }],
  }));
}

export const routeFlowDeriver: FlowDeriver = {
  id: 'routes',
  derive: async ({ read }) => deriveRouteFlows(await read.proxyRoutes.list()),
};
