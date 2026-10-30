import { describe, expect, it } from 'vitest';

import * as exported from '@stackmap/extension-core/flows';

import { dnsNamesByAddress, listenerIndex, reachableListeners } from './index';
import { growthRatio } from '../../../../tests/support/timing';

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

  it('dnsNamesByAddress resolves a CNAME fan-out in time that grows about linearly with its size', () => {
    const fanOut = (n: number) => [
      ...Array.from({ length: n }, (_, k) => record(10_000 + k, `n${String(k)}`, 'CNAME', 'hub.homelab.example')),
      ...Array.from({ length: n }, (_, k) => record(20_000 + k, 'hub', 'CNAME', `f${String(k)}.homelab.example`)),
      ...Array.from({ length: n }, (_, k) => record(30_000 + k, `f${String(k)}`, 'CNAME', 'x.homelab.example')),
      ...Array.from({ length: n }, (_, k) => record(40_000 + k, 'x', 'A', `198.51.100.${String((k % 250) + 1)}`)),
    ];
    const resolve = (n: number) => {
      const dnsRecords = fanOut(n);
      return () => dnsNamesByAddress({ domains: [DOMAIN], dnsRecords }, 'public');
    };

    // Linear is about 4; the cubic walk the review found was about 64.
    expect(growthRatio(resolve, 400)).toBeLessThan(8);
    expect(resolve(400)().get('198.51.100.1')?.hostnames).toContain('n0.homelab.example');
  });

  it('dnsNamesByAddress gives the records behind every address in time that grows about linearly with the aliases', () => {
    // Every alias reaches the same few addresses, so each address's records grow with the aliases, not faster.
    const fanOut = (n: number) => [
      ...Array.from({ length: n }, (_, k) => record(10_000 + k, `n${String(k)}`, 'CNAME', 'hub.homelab.example')),
      ...Array.from({ length: n }, (_, k) => record(20_000 + k, 'hub', 'CNAME', `f${String(k)}.homelab.example`)),
      ...Array.from({ length: n }, (_, k) => record(30_000 + k, `f${String(k)}`, 'CNAME', 'x.homelab.example')),
      ...Array.from({ length: 10 }, (_, k) => record(40_000 + k, 'x', 'A', `198.51.100.${String(k + 1)}`)),
    ];
    const basisOfEvery = (n: number) => {
      const dnsRecords = fanOut(n);
      return () => [...dnsNamesByAddress({ domains: [DOMAIN], dnsRecords }, 'public').values()]
        .map(({ recordIds }) => recordIds.length);
    };

    // Linear is about 4; copying every alias's CNAMEs for every name, as before, was about 16.
    expect(growthRatio(basisOfEvery, 100)).toBeLessThan(8);
    expect(basisOfEvery(100)()).toEqual(Array.from({ length: 10 }, () => 301));
  });

  it('dnsNamesByAddress gives the records behind every address in time that grows about linearly when names have several CNAMEs', () => {
    // Each g name has two CNAMEs, so it shares no addresses with another name: one group per name over a shared hub.
    const multiAliases = (n: number) => [
      ...Array.from({ length: n }, (_, k) => record(10_000 + k, 'hub', 'CNAME', `f${String(k)}.homelab.example`)),
      ...Array.from({ length: n }, (_, k) => record(20_000 + k, `f${String(k)}`, 'CNAME', 'x.homelab.example')),
      ...Array.from({ length: 10 }, (_, k) => record(30_000 + k, 'x', 'A', `198.51.100.${String(k + 1)}`)),
      ...Array.from({ length: n }, (_, k) => record(40_000 + k, `g${String(k)}`, 'CNAME', 'hub.homelab.example')),
      ...Array.from({ length: n }, (_, k) => record(50_000 + k, `g${String(k)}`, 'CNAME', 'f0.homelab.example')),
    ];
    const basisOfEvery = (n: number) => {
      const dnsRecords = multiAliases(n);
      return () => [...dnsNamesByAddress({ domains: [DOMAIN], dnsRecords }, 'public').values()]
        .map(({ recordIds }) => recordIds.length);
    };

    // Linear is about 4; walking the shared hub once per name, as before, was about 16.
    expect(growthRatio(basisOfEvery, 100)).toBeLessThan(8);
    expect(basisOfEvery(100)()).toEqual(Array.from({ length: 10 }, () => 401));
  });

  it('listenerIndex answers many addresses in time that grows about linearly with the workspace', () => {
    const workspace = (count: number) => {
      const hosts = Array.from({ length: count }, (_, index) => ({
        id: id(100_000 + index),
        addresses: [0, 1, 2, 3].map((n) => ({
          address: `10.${String(n)}.${String(Math.floor(index / 250))}.${String(index % 250)}`, networkId: null,
        })),
      }));
      const services = hosts.map((host, index) => ({ id: id(200_000 + index), hostId: host.id }));
      const listeners = services.flatMap((service, index) =>
        [listener(300_000 + index, '0.0.0.0'), listener(400_000 + index, null)].map((item) => ({ ...item, serviceId: service.id })));
      return { hosts, services, listeners };
    };
    // The index is built before the timer: its allocations make garbage collection, not the lookups, set the time.
    const lookUpEvery = (count: number) => {
      const entities = workspace(count);
      const listenersAt = listenerIndex(entities);
      return () => entities.hosts.flatMap(({ addresses }) => listenersAt(addresses[0]?.address ?? ''));
    };
    const entities = workspace(1000);

    // Linear is about 4; scanning every host per lookup, as before, was about 16.
    expect(growthRatio(lookUpEvery, 1000)).toBeLessThan(8);
    expect(lookUpEvery(1000)()).toHaveLength(1000);
    expect(reachableListeners(entities, '10.0.0.0')).toEqual(listenerIndex(entities)('10.0.0.0'));
  });
});
