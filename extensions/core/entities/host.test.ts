import { describe, expect, it } from 'vitest';

import { hostSchema } from './host';
import { issuePaths } from '../../../tests/support/issues';

const NETWORK_ID = '0199d6a0-0000-7000-8000-000000000001';

const parse = (input: Record<string, unknown>) => hostSchema.input.safeParse({ name: 'Home server', kind: 'physical', ...input });

describe('host schema', () => {
  it('requires a name and a kind; os and siteId are nullable', () => {
    expect(parse({}).data).toMatchObject({ name: 'Home server', kind: 'physical', os: null, siteId: null, addresses: [] });
    expect(issuePaths(hostSchema.input.safeParse({}))).toEqual(['name', 'kind']);
    expect(issuePaths(parse({ os: 'o'.repeat(101) }))).toEqual(['os']);
  });

  it('accepts up to 32 addresses, each an IP with a nullable network, normalized', () => {
    const addresses = Array.from({ length: 32 }, (_, index) => ({ address: `10.0.10.${String(index + 1)}` }));
    expect(parse({ addresses }).data?.addresses).toHaveLength(32);
    expect(issuePaths(parse({ addresses: [...addresses, { address: '10.0.10.200' }] }))).toEqual(['addresses']);

    expect(parse({ addresses: [{ address: '2001:DB8::1' }, { address: '10.0.10.20', networkId: NETWORK_ID }] }).data?.addresses)
      .toEqual([{ address: '2001:db8::1', networkId: null }, { address: '10.0.10.20', networkId: NETWORK_ID }]);
    expect(issuePaths(parse({ addresses: [{ address: 'server.homelab.example' }] }))).toEqual(['addresses.0.address']);
  });

  it('refuses the same address twice', () => {
    expect(issuePaths(parse({ addresses: [{ address: '10.0.10.20' }, { address: '10.0.10.20' }] })))
      .toEqual(['addresses.1.address']);
    expect(issuePaths(parse({ addresses: [{ address: '2001:db8::1' }, { address: '2001:DB8:0::1' }] })))
      .toEqual(['addresses.1.address']);
  });
});
