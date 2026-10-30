import { describe, expect, it } from 'vitest';

import { deriveDnsFlows } from './dns';

import type { DnsFlowEntities } from './dns';
import type { FlowDraft } from '@stackmap/extension-sdk/server';

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

const DOMAIN = { id: id(1), name: 'homelab.example' };
const SERVER = { id: id(2), addresses: [{ address: '10.0.10.20', networkId: null }, { address: '2001:db8::20', networkId: null }] };
const APP = { id: id(3), hostId: SERVER.id };

type RecordInput = Partial<DnsFlowEntities['dnsRecords'][number]> & { id: string };
const record = (overrides: RecordInput) => ({
  domainId: DOMAIN.id, name: 'app', type: 'A' as const, value: '10.0.10.20', view: 'internal' as const, ...overrides,
});
const listener = (n: number, bindAddress: string | null) => ({ id: id(n), serviceId: APP.id, bindAddress });

const derive = (overrides: Partial<DnsFlowEntities>) => deriveDnsFlows({
  domains: [DOMAIN], dnsRecords: [], hosts: [SERVER], services: [APP], listeners: [], ...overrides,
});

/** The drafts with their basis in id order, which the deriver does not promise. */
const sorted = (drafts: FlowDraft[]) => drafts
  .map((draft) => ({ ...draft, basis: [...draft.basis].sort((a, b) => a.id.localeCompare(b.id)) }))
  .sort((a, b) => a.key.localeCompare(b.key));

const entry = (view: 'public' | 'internal', listenerId: string, hostnames: string[], recordIds: string[]): FlowDraft => ({
  key: `${view}:${listenerId}`,
  source: { client: view },
  targetListenerId: listenerId,
  hostnames,
  basis: recordIds.map((recordId) => ({ entity: 'dns-record', id: recordId })),
});

describe('core DNS flow deriver', () => {
  it('given an A record whose address a host holds, gives a flow from the record\'s view\'s client to its listeners bound to 0.0.0.0, with the hostname', () => {
    const any = listener(10, '0.0.0.0');

    expect(derive({ dnsRecords: [record({ id: id(20) })], listeners: [any] }))
      .toEqual([entry('internal', any.id, ['app.homelab.example'], [id(20)])]);
  });

  it('gives a flow to a listener bound to the record\'s exact address, and none to one bound to another address or to no address', () => {
    const exact = listener(10, '10.0.10.20');

    expect(derive({
      dnsRecords: [record({ id: id(20) })],
      listeners: [exact, listener(11, '127.0.0.1'), listener(12, '10.0.10.21'), listener(13, null)],
    })).toEqual([entry('internal', exact.id, ['app.homelab.example'], [id(20)])]);
  });

  it('given an AAAA record, gives flows to listeners bound to :: or to that address, and none to those bound to 0.0.0.0', () => {
    const anyV6 = listener(10, '::');
    const exact = listener(11, '2001:db8::20');

    expect(sorted(derive({
      dnsRecords: [record({ id: id(20), type: 'AAAA', value: '2001:db8::20' })],
      listeners: [anyV6, exact, listener(12, '0.0.0.0')],
    }))).toEqual(sorted([
      entry('internal', anyV6.id, ['app.homelab.example'], [id(20)]),
      entry('internal', exact.id, ['app.homelab.example'], [id(20)]),
    ]));
  });

  it('adds the hostname of a CNAME leading to an A record through the workspace\'s records, with both records in the basis', () => {
    const any = listener(10, '0.0.0.0');

    expect(sorted(derive({
      dnsRecords: [
        record({ id: id(20), name: '@' }),
        record({ id: id(21), name: 'www', type: 'CNAME', value: 'homelab.example' }),
        record({ id: id(22), name: 'blog', type: 'CNAME', value: 'www.homelab.example' }),
      ],
      listeners: [any],
    }))).toEqual([
      entry('internal', any.id, ['blog.homelab.example', 'homelab.example', 'www.homelab.example'], [id(20), id(21), id(22)]),
    ]);
  });

  it('gives no flow for a CNAME loop, a chain longer than 8 steps, or a CNAME leaving the workspace\'s domains', () => {
    const any = listener(10, '0.0.0.0');
    const chain = Array.from({ length: 9 }, (_, index) => record({
      id: id(40 + index), name: `c${String(index)}`, type: 'CNAME', value: `c${String(index + 1)}.homelab.example`,
    }));

    // c1 reaches c9 in 8 steps and is kept; c0 needs 9.
    const kept = chain.slice(1);

    expect(sorted(derive({
      dnsRecords: [
        record({ id: id(20), name: 'loop-a', type: 'CNAME', value: 'loop-b.homelab.example' }),
        record({ id: id(21), name: 'loop-b', type: 'CNAME', value: 'loop-a.homelab.example' }),
        record({ id: id(22), name: 'away', type: 'CNAME', value: 'app.elsewhere.example' }),
        ...chain,
        record({ id: id(30), name: 'c9' }),
      ],
      listeners: [any],
    }))).toEqual(sorted([entry(
      'internal',
      any.id,
      [...kept.map(({ name }) => `${name}.homelab.example`), 'c9.homelab.example'],
      [...kept.map((link) => link.id), id(30)],
    )]));
  });

  it('names an @ record after its domain and keeps a wildcard as *.<rest>.<domain>', () => {
    const any = listener(10, '0.0.0.0');

    expect(sorted(derive({
      dnsRecords: [record({ id: id(20), name: '@' }), record({ id: id(21), name: '*.dev' })],
      listeners: [any],
    }))).toEqual([entry('internal', any.id, ['*.dev.homelab.example', 'homelab.example'], [id(20), id(21)])]);
  });

  it('gives one flow per client when a public and an internal record reach the same listener', () => {
    const any = listener(10, '0.0.0.0');

    expect(sorted(derive({
      dnsRecords: [record({ id: id(20), view: 'internal' }), record({ id: id(21), name: 'www', view: 'public' })],
      listeners: [any],
    }))).toEqual([
      entry('internal', any.id, ['app.homelab.example'], [id(20)]),
      entry('public', any.id, ['www.homelab.example'], [id(21)]),
    ]);
  });

  it('gives no flow for an address no host holds, or for MX, TXT, SRV, NS and CAA records', () => {
    expect(derive({
      dnsRecords: [
        record({ id: id(20), value: '10.0.10.99' }),
        record({ id: id(21), type: 'MX', value: '10 10.0.10.20' }),
        record({ id: id(22), type: 'TXT', value: '10.0.10.20' }),
        record({ id: id(23), type: 'SRV', value: '0 5 443 app.homelab.example' }),
        record({ id: id(24), type: 'NS', value: 'ns.homelab.example' }),
        record({ id: id(25), type: 'CAA', value: '0 issue "letsencrypt.org"' }),
      ],
      listeners: [listener(10, '0.0.0.0')],
    })).toEqual([]);
  });

  it('resolves a CNAME only through records of its own view', () => {
    const any = listener(10, '0.0.0.0');

    expect(derive({
      dnsRecords: [
        record({ id: id(20), name: 'app', view: 'internal' }),
        record({ id: id(21), name: 'www', type: 'CNAME', value: 'app.homelab.example', view: 'public' }),
      ],
      listeners: [any],
    })).toEqual([entry('internal', any.id, ['app.homelab.example'], [id(20)])]);
  });

  it('resolves a dense CNAME graph in well under 100 ms', () => {
    const names = Array.from({ length: 8 }, (_, index) => `n${String(index)}`);
    // Every name has a CNAME to every other name, and one of them an A record.
    const clique = names.flatMap((name, from) => names.filter((_, to) => to !== from).map((target, to) => record({
      id: id(1000 + (from * 100) + to), name, type: 'CNAME', value: `${target}.homelab.example`,
    })));
    const any = listener(10, '0.0.0.0');
    const started = performance.now();

    const drafts = derive({ dnsRecords: [...clique, record({ id: id(20), name: 'n0' })], listeners: [any] });

    expect(performance.now() - started).toBeLessThan(100);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.hostnames).toEqual(names.map((name) => `${name}.homelab.example`).sort());
  });
});
