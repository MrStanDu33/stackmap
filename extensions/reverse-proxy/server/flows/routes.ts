import type { ProxyRoute } from '../../entities';
import type { FlowDeriver, FlowDraft } from '@stackmap/extension-sdk/server';

/** One flow per route: from the proxy to its upstream, for the route's hostnames. */
export function deriveRouteFlows(
  _routes: readonly Pick<ProxyRoute, 'id' | 'proxyServiceId' | 'upstreamListenerId' | 'hostnames'>[],
): FlowDraft[] {
  throw new Error('Not implemented');
}

export const routeFlowDeriver: FlowDeriver = {
  id: 'routes',
  derive: () => Promise.reject(new Error('Not implemented')),
};
