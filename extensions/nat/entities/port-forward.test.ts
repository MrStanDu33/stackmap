import { describe, expect, it } from 'vitest';

import { portForwardSchema } from './port-forward';
import { issueMessages, issuePaths } from '../../../tests/support/issues';

const HOST_ID = '0199d6a0-0000-7000-8000-000000000001';

const parse = (input: Record<string, unknown>) => portForwardSchema.input.safeParse({
  hostId: HOST_ID,
  externalAddress: '203.0.113.10',
  externalPort: 443,
  transport: 'tcp',
  internalAddress: '10.0.10.20',
  internalPort: 443,
  ...input,
});

describe('port forward schema', () => {
  it('given a host, an external address and port, a transport and an internal address and port, defaults the description to null and fills the common fields', () => {
    expect(issuePaths(portForwardSchema.input.safeParse({})))
      .toEqual(['hostId', 'externalAddress', 'externalPort', 'transport', 'internalAddress', 'internalPort']);
    expect(parse({}).data).toMatchObject({
      hostId: HOST_ID,
      externalAddress: '203.0.113.10',
      externalPort: 443,
      transport: 'tcp',
      internalAddress: '10.0.10.20',
      internalPort: 443,
      description: null,
      status: 'active',
    });
    expect(parse({ externalAddress: '2001:DB8::10', internalAddress: '2001:db8:0::20' }).data)
      .toMatchObject({ externalAddress: '2001:db8::10', internalAddress: '2001:db8::20' });
  });

  it('refuses ports outside 1-65535, a transport other than tcp or udp, and addresses that are not IPs', () => {
    expect(issuePaths(parse({ externalPort: 0, internalPort: 65_536, transport: 'sctp' })))
      .toEqual(['externalPort', 'transport', 'internalPort']);
    expect(issuePaths(parse({ externalAddress: 'router.homelab.example' }))).toEqual(['externalAddress']);
    expect(issuePaths(parse({ internalAddress: '10.0.10' }))).toEqual(['internalAddress']);
    expect(issuePaths(parse({ description: 'Web\nand more' }))).toEqual(['description']);
  });

  it('refuses an internal address of another IP version than the external one, with an issue on internalAddress', () => {
    expect(issuePaths(parse({ internalAddress: '2001:db8::20' }))).toEqual(['internalAddress']);
    expect(issuePaths(parse({ externalAddress: '2001:db8::10' }))).toEqual(['internalAddress']);
    expect(issueMessages(parse({ internalAddress: '2001:db8::20' })))
      .toEqual(['Expected an address of the same IP version as the external one']);
  });
});
