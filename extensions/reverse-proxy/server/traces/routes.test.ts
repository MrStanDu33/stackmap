import { describe, expect, it } from 'vitest';

import { resolveRouteHops } from './routes';

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

const NPM = { id: id(1), name: 'Nginx Proxy Manager' };
const SITE = { id: id(40), proxyServiceId: NPM.id, hostnames: ['homelab.example', 'app.homelab.example'] };
const WILDCARD = { id: id(41), proxyServiceId: NPM.id, hostnames: ['*.dev.homelab.example'] };

const resolve = (hostname: string, ids: string[]) =>
  resolveRouteHops({ routes: [SITE, WILDCARD], services: [NPM] }, hostname, ids);

describe('route hop resolver', () => {
  it('given a route, gives a proxy hop with the proxy and the traced hostname', () => {
    expect(resolve('app.homelab.example', [SITE.id])).toEqual([{
      entity: 'route', id: SITE.id, stage: 'proxy', label: 'extensions.reverse-proxy.trace.route',
      params: { proxy: 'Nginx Proxy Manager', hostname: 'app.homelab.example' },
    }]);
    expect(resolve('a.dev.homelab.example', [WILDCARD.id])).toMatchObject([
      { id: WILDCARD.id, params: { hostname: '*.dev.homelab.example' } },
    ]);
  });
});
