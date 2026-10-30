import { describe, expect, it } from 'vitest';

import { proxyRouteSchema } from './route';
import { issuePaths } from '../../../tests/support/issues';

const PROXY_ID = '0199d6a0-0000-7000-8000-000000000001';
const LISTENER_ID = '0199d6a0-0000-7000-8000-000000000002';

const parse = (input: Record<string, unknown>) => proxyRouteSchema.input.safeParse({
  proxyServiceId: PROXY_ID, hostnames: ['app.homelab.example'], upstreamListenerId: LISTENER_ID, ...input,
});

describe('proxy route schema', () => {
  it('given a proxy service, hostnames and an upstream listener, defaults forceSsl and websockets to false and fills the common fields', () => {
    expect(parse({}).data).toMatchObject({
      proxyServiceId: PROXY_ID,
      hostnames: ['app.homelab.example'],
      upstreamListenerId: LISTENER_ID,
      forceSsl: false,
      websockets: false,
      status: 'active',
      tags: [],
    });
    expect(issuePaths(proxyRouteSchema.input.safeParse({}))).toEqual(['proxyServiceId', 'hostnames', 'upstreamListenerId']);
  });

  it('given hostnames in mixed case or with a trailing dot, stores them lowercase without the dot, in the given order', () => {
    expect(parse({ hostnames: ['WWW.Homelab.Example.', 'homelab.example'] }).data?.hostnames)
      .toEqual(['www.homelab.example', 'homelab.example']);
  });

  it('accepts a wildcard hostname such as *.homelab.example', () => {
    expect(parse({ hostnames: ['*.Homelab.example'] }).data?.hostnames).toEqual(['*.homelab.example']);
  });

  it('refuses app.*.example, *, an IP address or a non-ASCII name, with an issue on that hostname', () => {
    for (const hostname of ['app.*.example', '*', '203.0.113.10', '2001:db8::1', 'café.example', 'a'.repeat(254)]) {
      expect(issuePaths(parse({ hostnames: ['homelab.example', hostname] })), hostname).toEqual(['hostnames.1']);
    }
  });

  it('refuses no hostname, more than 50, or the same hostname twice, with an issue on hostnames', () => {
    const many = Array.from({ length: 51 }, (_, index) => `app${String(index)}.homelab.example`);

    expect(issuePaths(parse({ hostnames: [] }))).toEqual(['hostnames']);
    expect(issuePaths(parse({ hostnames: many }))).toEqual(['hostnames']);
    expect(parse({ hostnames: many.slice(0, 50) }).success).toBe(true);
    expect(issuePaths(parse({ hostnames: ['app.homelab.example', 'APP.homelab.example.'] }))).toEqual(['hostnames']);
  });
});
