import { describe, expect, it } from 'vitest';

import { networkSchema } from './network';
import { issuePaths } from '../../tests/support/issues';

const parse = (input: Record<string, unknown>) => networkSchema.input.safeParse({ name: 'Home LAN', kind: 'lan', ...input });

describe('network schema', () => {
  it('requires a name and a kind; cidr, vlan and siteId are nullable', () => {
    expect(parse({}).data).toMatchObject({ name: 'Home LAN', kind: 'lan', cidr: null, vlan: null, siteId: null });
    expect(issuePaths(networkSchema.input.safeParse({}))).toEqual(['name', 'kind']);
    expect(issuePaths(parse({ kind: 'Not Kebab' }))).toEqual(['kind']);
    expect(issuePaths(parse({ siteId: 'home' }))).toEqual(['siteId']);
  });

  it('normalizes the CIDR and refuses one with host bits set', () => {
    expect(parse({ cidr: '2001:DB8::/48' }).data?.cidr).toBe('2001:db8::/48');
    expect(issuePaths(parse({ cidr: '10.0.10.5/24' }))).toEqual(['cidr']);
  });

  it('accepts a VLAN from 1 to 4094', () => {
    expect(parse({ vlan: 1 }).success).toBe(true);
    expect(parse({ vlan: 4094 }).success).toBe(true);
    for (const vlan of [0, 4095, 1.5]) {
      expect(issuePaths(parse({ vlan }))).toEqual(['vlan']);
    }
  });
});
