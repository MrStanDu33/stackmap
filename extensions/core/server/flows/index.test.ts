import { describe, expect, it } from 'vitest';

import * as exported from '@stackmap/extension-core/flows';

import { dnsNamesByAddress, reachableListeners } from './index';

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

const SERVER = { id: id(1), addresses: [{ address: '10.0.10.20', networkId: null }, { address: '2001:db8::20', networkId: null }] };
const APP = { id: id(2), hostId: SERVER.id };
const listener = (n: number, bindAddress: string | null) => ({ id: id(n), serviceId: APP.id, bindAddress });
const DOMAIN = { id: id(3), name: 'homelab.example' };
const record = (n: number, name: string, type: 'A' | 'AAAA' | 'CNAME', value: string, view: 'public' | 'internal' = 'public') =>
  ({ id: id(n), domainId: DOMAIN.id, name, type, value, view });

describe('core flow helpers', () => {
  it('reachableListeners gives the listeners bound to an address, or to every address of its IP version, on the hosts holding it', () => {
    const listeners = [
      listener(10, '0.0.0.0'), listener(11, '10.0.10.20'), listener(12, '::'), listener(13, '2001:db8::20'),
      listener(14, '127.0.0.1'), listener(15, null),
    ];
    const entities = { hosts: [SERVER], services: [APP], listeners };

    expect(reachableListeners(entities, '10.0.10.20').map(({ id: listenerId }) => listenerId)).toEqual([id(10), id(11)]);
    expect(reachableListeners(entities, '2001:db8::20').map(({ id: listenerId }) => listenerId)).toEqual([id(12), id(13)]);
    expect(reachableListeners(entities, '10.0.10.99')).toEqual([]);
  });

  it('dnsNamesByAddress gives, per address, the hostnames of a view resolving to it through CNAMEs, with the records used', () => {
    const entities = {
      domains: [DOMAIN],
      dnsRecords: [
        record(20, '@', 'A', '203.0.113.10'),
        record(21, 'www', 'CNAME', 'homelab.example'),
        record(22, 'app', 'A', '203.0.113.10'),
        record(23, 'npm', 'A', '10.0.10.20', 'internal'),
        record(24, 'lan', 'CNAME', 'npm.homelab.example', 'public'),
      ],
    };

    const names = dnsNamesByAddress(entities, 'public');

    expect([...names.keys()]).toEqual(['203.0.113.10']);
    expect(names.get('203.0.113.10')?.hostnames).toEqual(['app.homelab.example', 'homelab.example', 'www.homelab.example']);
    expect([...(names.get('203.0.113.10')?.recordIds ?? [])].sort()).toEqual([id(20), id(21), id(22)]);
    expect(dnsNamesByAddress(entities, 'internal').get('10.0.10.20'))
      .toEqual({ hostnames: ['npm.homelab.example'], recordIds: [id(23)] });
  });

  it('are exported from @stackmap/extension-core/flows', () => {
    expect(exported.reachableListeners).toBe(reachableListeners);
    expect(exported.dnsNamesByAddress).toBe(dnsNamesByAddress);
    expect(typeof exported.deriveDnsFlows).toBe('function');
  });
});
