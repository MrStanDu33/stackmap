import { describe, expect, it } from 'vitest';

import { resolvePortForwardHops } from './port-forwards';

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

const ROUTER = { id: id(1), name: 'Edge router' };
const FORWARD = {
  id: id(30), hostId: ROUTER.id, externalAddress: '203.0.113.10', externalPort: 8443, transport: 'tcp' as const,
  internalAddress: '10.0.10.20', internalPort: 443,
};

describe('port-forward hop resolver', () => {
  it('given a forward, gives a network hop with the router, external and internal endpoints and the external port', () => {
    expect(resolvePortForwardHops({ portForwards: [FORWARD], hosts: [ROUTER] }, [FORWARD.id, id(99)])).toEqual([{
      entity: 'port-forward',
      id: FORWARD.id,
      stage: 'network',
      label: 'extensions.nat.trace.forward',
      params: { router: 'Edge router', external: '203.0.113.10:8443/tcp', internal: '10.0.10.20:443' },
      port: 8443,
    }]);
  });
});
