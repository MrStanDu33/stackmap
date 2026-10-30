import { describe, expect, it } from 'vitest';

import { derivePortForwardFlows } from './port-forwards';

import type { PortForwardFlowEntities } from './port-forwards';

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

const DOMAIN = { id: id(1), name: 'homelab.example' };
const ROUTER = { id: id(2), addresses: [{ address: '203.0.113.10', networkId: null }, { address: '10.0.10.1', networkId: null }] };
const SERVER = { id: id(3), addresses: [{ address: '10.0.10.20', networkId: null }] };
const NPM = { id: id(4), hostId: SERVER.id };

type ListenerInput = Partial<PortForwardFlowEntities['listeners'][number]> & { id: string };
const listener = (overrides: ListenerInput) => ({
  serviceId: NPM.id, port: 443, transport: 'tcp' as const, bindAddress: '0.0.0.0', publishedPort: null, ...overrides,
});
type ForwardInput = Partial<PortForwardFlowEntities['portForwards'][number]> & { id: string };
const forward = (overrides: ForwardInput) => ({
  hostId: ROUTER.id, externalAddress: '203.0.113.10', transport: 'tcp' as const, internalAddress: '10.0.10.20', internalPort: 443,
  ...overrides,
});
const record = (n: number, name: string, type: 'A' | 'CNAME', value: string, view: 'public' | 'internal' = 'public') =>
  ({ id: id(n), domainId: DOMAIN.id, name, type, value, view });

const derive = (overrides: Partial<PortForwardFlowEntities>) => derivePortForwardFlows({
  domains: [DOMAIN], dnsRecords: [], hosts: [ROUTER, SERVER], services: [NPM], listeners: [], portForwards: [],
  ...overrides,
});

describe('port forward flow deriver', () => {
  it('gives a flow from the public client to a listener bound to the internal address or to all addresses on the internal port, keyed by the forward and the listener, with the forward in its basis', () => {
    const any = listener({ id: id(10) });
    const exact = listener({ id: id(11), bindAddress: '10.0.10.20' });

    expect(derive({ listeners: [any, exact], portForwards: [forward({ id: id(30) })] })).toEqual([
      { key: `${id(30)}:${id(10)}`, source: { client: 'public' }, targetListenerId: id(10), hostnames: [], basis: [{ entity: 'port-forward', id: id(30) }] },
      { key: `${id(30)}:${id(11)}`, source: { client: 'public' }, targetListenerId: id(11), hostnames: [], basis: [{ entity: 'port-forward', id: id(30) }] },
    ]);
  });

  it('matches a container listener on its published port', () => {
    const container = listener({ id: id(10), port: 3443, publishedPort: 443 });

    expect(derive({ listeners: [container], portForwards: [forward({ id: id(30) })] }))
      .toMatchObject([{ targetListenerId: id(10) }]);
    expect(derive({ listeners: [container], portForwards: [forward({ id: id(30), internalPort: 3443 })] })).toEqual([]);
  });

  it('gives no flow to a listener on another port, with another transport, bound to another address or to no address', () => {
    expect(derive({
      listeners: [
        listener({ id: id(10), port: 8443 }),
        listener({ id: id(11), transport: 'udp' }),
        listener({ id: id(12), bindAddress: '127.0.0.1' }),
        listener({ id: id(13), bindAddress: null }),
      ],
      portForwards: [forward({ id: id(30) })],
    })).toEqual([]);
  });

  it('gives no flow for a forward that reaches no listener', () => {
    const nowhere = forward({ id: id(30), internalAddress: '10.0.10.99' });

    expect(derive({ listeners: [listener({ id: id(10) })], portForwards: [nowhere] })).toEqual([]);
  });

  it('carries the hostnames of the public records, direct or through CNAMEs, that resolve to the external address, with those records in the basis', () => {
    const [flow] = derive({
      dnsRecords: [record(20, '@', 'A', '203.0.113.10'), record(21, 'www', 'CNAME', 'homelab.example')],
      listeners: [listener({ id: id(10) })],
      portForwards: [forward({ id: id(30) })],
    });

    expect(flow?.hostnames).toEqual(['homelab.example', 'www.homelab.example']);
    expect(flow?.basis).toEqual([
      { entity: 'port-forward', id: id(30) }, { entity: 'dns-record', id: id(20) }, { entity: 'dns-record', id: id(21) },
    ]);
  });

  it('ignores internal records and records of other addresses', () => {
    expect(derive({
      dnsRecords: [record(20, 'npm', 'A', '203.0.113.10', 'internal'), record(21, 'other', 'A', '198.51.100.7')],
      listeners: [listener({ id: id(10) })],
      portForwards: [forward({ id: id(30) })],
    })).toMatchObject([{ hostnames: [], basis: [{ entity: 'port-forward', id: id(30) }] }]);
  });

  it('gives the flow with no hostname when no record names the external address', () => {
    const ssh = forward({ id: id(30), internalPort: 22 });

    expect(derive({ listeners: [listener({ id: id(10), port: 22 })], portForwards: [ssh] }))
      .toMatchObject([{ targetListenerId: id(10), hostnames: [] }]);
  });

  it('gives one flow per listener when two hosts hold the internal address', () => {
    const twin = { id: id(5), addresses: [{ address: '10.0.10.20', networkId: null }] };
    const other = { id: id(6), hostId: twin.id };

    expect(derive({
      hosts: [ROUTER, SERVER, twin],
      services: [NPM, other],
      listeners: [listener({ id: id(10) }), listener({ id: id(11), serviceId: other.id })],
      portForwards: [forward({ id: id(30) })],
    }).map(({ targetListenerId }) => targetListenerId).sort()).toEqual([id(10), id(11)]);
  });

  describe('which hosts a forward reaches', () => {
    const LAN = id(40);
    const LAB = id(41);
    const router = { id: id(2), addresses: [{ address: '203.0.113.10', networkId: null }, { address: '192.168.1.1', networkId: LAN }] };
    const onLan = { id: id(5), addresses: [{ address: '192.168.1.10', networkId: LAN }] };
    const onLab = { id: id(6), addresses: [{ address: '192.168.1.10', networkId: LAB }] };
    const unknown = { id: id(7), addresses: [{ address: '192.168.1.10', networkId: null }] };
    const services = [onLan, onLab, unknown, router].map((host, index) => ({ id: id(50 + index), hostId: host.id }));
    const listeners = services.map((service, index) => listener({ id: id(60 + index), serviceId: service.id }));
    const targets = (hosts: { id: string; addresses: { address: string; networkId: string | null }[] }[], internalAddress = '192.168.1.10') =>
      derive({ hosts, services, listeners, portForwards: [forward({ id: id(30), internalAddress })] })
        .map(({ targetListenerId }) => targetListenerId).sort();

    it('reaches a host holding the internal address on a network the forwarding host is on, not one on another network', () => {
      expect(targets([router, onLan, onLab])).toEqual([id(60)]);
    });

    it('reaches a host whose address has no documented network, so missing data never hides exposure', () => {
      expect(targets([router, onLan, onLab, unknown])).toEqual([id(60), id(62)]);
    });

    it('reaches every holder when the forwarding host documents no network', () => {
      const bare = { id: router.id, addresses: [{ address: '203.0.113.10', networkId: null }] };

      expect(targets([bare, onLan, onLab])).toEqual([id(60), id(61)]);
    });

    it('reaches the forwarding host itself, such as a VPS forwarding to its own loopback', () => {
      const vps = { id: router.id, addresses: [...router.addresses, { address: '127.0.0.1', networkId: null }] };
      const elsewhere = { id: id(5), addresses: [{ address: '127.0.0.1', networkId: LAB }] };

      expect(targets([vps, elsewhere], '127.0.0.1')).toEqual([id(63)]);
    });
  });

  it('gives no flow for a forward whose host no longer holds its external address', () => {
    const moved = { ...ROUTER, addresses: [{ address: '203.0.113.11', networkId: null }] };

    expect(derive({
      hosts: [moved, SERVER],
      dnsRecords: [record(20, 'app', 'A', '203.0.113.10')],
      listeners: [listener({ id: id(10) })],
      portForwards: [forward({ id: id(30) })],
    })).toEqual([]);
  });

  it('gives an internal flow, named by the internal records, for a forward on a private, carrier-grade NAT or loopback address', () => {
    for (const address of ['10.0.10.1', '172.16.0.1', '192.168.1.1', '100.64.0.5', '127.0.0.1', 'fd00::1', 'fe80::1']) {
      const router = { id: ROUTER.id, addresses: [{ address, networkId: null }] };
      const [flow] = derive({
        hosts: [router, SERVER],
        dnsRecords: [record(20, 'gw', 'A', address, 'internal'), record(21, 'pub', 'A', address)],
        listeners: [listener({ id: id(10) })],
        portForwards: [forward({ id: id(30), externalAddress: address })],
      });

      expect(flow, address).toMatchObject({ source: { client: 'internal' }, hostnames: ['gw.homelab.example'] });
    }
  });

  it('keeps a public flow for a forward on a public address', () => {
    expect(derive({ listeners: [listener({ id: id(10) })], portForwards: [forward({ id: id(30) })] }))
      .toMatchObject([{ source: { client: 'public' } }]);
  });

  it('derives the flows of thousands of forwards in well under 200 ms', () => {
    const count = 4000;
    const hosts = Array.from({ length: count }, (_, index) => ({
      id: id(100_000 + index),
      addresses: [{ address: `10.${String(Math.floor(index / 250))}.${String(index % 250)}.1`, networkId: null }],
    }));
    const services = hosts.map((host, index) => ({ id: id(200_000 + index), hostId: host.id }));
    const many = services.flatMap((service, index) => [
      listener({ id: id(300_000 + index), serviceId: service.id }),
      listener({ id: id(400_000 + index), serviceId: service.id, port: 80 }),
    ]);
    const forwards = hosts.map((host, index) => forward({
      id: id(500_000 + index), internalAddress: host.addresses[0]?.address ?? '',
    }));
    const started = performance.now();

    const drafts = derive({ hosts: [ROUTER, ...hosts], services, listeners: many, portForwards: forwards });

    expect(performance.now() - started).toBeLessThan(200);
    expect(drafts).toHaveLength(count);
  });
});
