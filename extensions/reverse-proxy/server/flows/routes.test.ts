import { describe, expect, it } from 'vitest';

import { deriveRouteFlows } from './routes';

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

const PROXY = id(1);

describe('reverse proxy route flow deriver', () => {
  it('given a proxy route, gives a flow from the proxy service to the upstream listener with the route\'s hostnames, keyed by and based on the route', () => {
    const route = { id: id(10), proxyServiceId: PROXY, upstreamListenerId: id(20), hostnames: ['www.homelab.example', 'homelab.example'] };

    expect(deriveRouteFlows([route])).toEqual([{
      key: route.id,
      source: { serviceId: PROXY },
      targetListenerId: id(20),
      hostnames: ['www.homelab.example', 'homelab.example'],
      basis: [{ entity: 'route', id: route.id }],
    }]);
  });

  it('gives a flow for a route whose upstream is the proxy\'s own listener', () => {
    const own = { id: id(11), proxyServiceId: PROXY, upstreamListenerId: id(21), hostnames: ['npm.homelab.example'] };

    expect(deriveRouteFlows([own])).toMatchObject([{ source: { serviceId: PROXY }, targetListenerId: id(21) }]);
  });
});
