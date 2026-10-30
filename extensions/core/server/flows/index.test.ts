import { describe, expect, it } from 'vitest';

import * as exported from '@stackmap/extension-core/flows';

import { dnsNamesByAddress, listenerIndex, reachableListeners } from './index';

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
    expect(exported.listenerIndex).toBe(listenerIndex);
    expect(typeof exported.deriveDnsFlows).toBe('function');
  });

  it('dnsNamesByAddress resolves a CNAME fan-out in well under 100 ms', () => {
    const n = 400;
    const records = [
      ...Array.from({ length: n }, (_, k) => record(10_000 + k, `n${String(k)}`, 'CNAME', 'hub.homelab.example')),
      ...Array.from({ length: n }, (_, k) => record(20_000 + k, 'hub', 'CNAME', `f${String(k)}.homelab.example`)),
      ...Array.from({ length: n }, (_, k) => record(30_000 + k, `f${String(k)}`, 'CNAME', 'x.homelab.example')),
      ...Array.from({ length: n }, (_, k) => record(40_000 + k, 'x', 'A', `198.51.100.${String((k % 250) + 1)}`)),
    ];
    const started = performance.now();

    const names = dnsNamesByAddress({ domains: [DOMAIN], dnsRecords: records }, 'public');

    expect(performance.now() - started).toBeLessThan(100);
    expect(names.get('198.51.100.1')?.hostnames).toContain('n0.homelab.example');
  });

  it('reachableListeners answers thousands of addresses in well under 100 ms', () => {
    const count = 4000;
    const hosts = Array.from({ length: count }, (_, index) => ({
      id: id(100_000 + index),
      addresses: [0, 1, 2, 3].map((n) => ({ address: `10.${String(n)}.${String(Math.floor(index / 250))}.${String(index % 250)}`, networkId: null })),
    }));
    const services = hosts.map((host, index) => ({ id: id(200_000 + index), hostId: host.id }));
    const listeners = services.flatMap((service, index) =>
      [listener(300_000 + index, '0.0.0.0'), listener(400_000 + index, null)].map((item) => ({ ...item, serviceId: service.id })));
    const listenersAt = listenerIndex({ hosts, services, listeners });
    const started = performance.now();

    const reached = hosts.flatMap(({ addresses }) => listenersAt(addresses[0]?.address ?? ''));

    expect(performance.now() - started).toBeLessThan(100);
    expect(reached).toHaveLength(count);
    expect(reachableListeners({ hosts, services, listeners }, '10.0.0.0')).toEqual(listenersAt('10.0.0.0'));
  });
});
