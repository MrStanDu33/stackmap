import { describe, expect, it } from 'vitest';

import { buildProxyRoute } from './factories';
import { isFictionalDnsName } from '../../../tests/support/fictional';
import { proxyRouteSchema } from '../entities';

describe('proxy route factories', () => {
  it('buildProxyRoute returns a valid input with the overrides', () => {
    const first = buildProxyRoute();
    const second = buildProxyRoute({ forceSsl: true });

    expect(proxyRouteSchema.input.safeParse(first).success).toBe(true);
    expect(first.hostnames.every(isFictionalDnsName)).toBe(true);
    expect(second.hostnames).not.toEqual(first.hostnames);
    expect(second.forceSsl).toBe(true);
  });
});
