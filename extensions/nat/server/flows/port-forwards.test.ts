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
  externalAddress: '203.0.113.10', transport: 'tcp' as const, internalAddress: '10.0.10.20', internalPort: 443,
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
});
