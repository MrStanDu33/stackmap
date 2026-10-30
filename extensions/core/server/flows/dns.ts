import { DNS_VIEWS } from '../../entities';

import type { DnsRecord, DnsView, Domain, Host, Listener, Service } from '../../entities';
import type { FlowDeriver, FlowDraft } from '@stackmap/extension-sdk/server';

/** What the DNS deriver reads: the workspace's records and what their addresses lead to. */
export interface DnsFlowEntities {
  domains: readonly Pick<Domain, 'id' | 'name'>[];
  dnsRecords: readonly Pick<DnsRecord, 'id' | 'domainId' | 'name' | 'type' | 'value' | 'view'>[];
  hosts: readonly Pick<Host, 'id' | 'addresses'>[];
  services: readonly Pick<Service, 'id' | 'hostId'>[];
  listeners: readonly Pick<Listener, 'id' | 'serviceId' | 'bindAddress'>[];
}

type DnsRecordView = DnsFlowEntities['dnsRecords'][number];

/** The hostnames of a view that resolve to an address, through CNAMEs, and the records used. */
export interface AddressNames {
  hostnames: string[];
  recordIds: string[];
}

/** How many CNAMEs a name may go through before it reaches an address, as resolvers cap it. */
const MAX_CNAME_STEPS = 8;

const groupBy = <T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> => {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item]);
  }
  return groups;
};

/**
 * The listeners reachable at an address: on the hosts holding it, bound to it or to every address of its IP
 * version. A null bind address (container network, external service) is never reachable.
 */
export function reachableListeners<L extends DnsFlowEntities['listeners'][number]>(
  { hosts, services, listeners }: Pick<DnsFlowEntities, 'hosts' | 'services'> & { listeners: readonly L[] },
  address: string,
): L[] {
  const any = address.includes(':') ? '::' : '0.0.0.0';
  const hostIds = new Set(hosts.filter(({ addresses }) => addresses.some((held) => held.address === address))
    .map(({ id }) => id));
  const serviceIds = new Set(services.filter(({ hostId }) => hostId !== null && hostIds.has(hostId))
    .map(({ id }) => id));
  return listeners.filter(({ serviceId, bindAddress }) =>
    serviceIds.has(serviceId) && (bindAddress === address || bindAddress === any));
}

/**
 * For each address, the hostnames of a view resolving to it: A/AAAA records, and CNAMEs of the same view leading to
 * them (as a split-horizon resolver does). Each name is visited once, at its shortest distance, so a dense CNAME graph
 * costs its size, not its number of paths.
 */
export function dnsNamesByAddress(
  { domains, dnsRecords }: Pick<DnsFlowEntities, 'domains' | 'dnsRecords'>,
  view: DnsView,
): Map<string, AddressNames> {
  const domainNames = new Map(domains.map(({ id, name }) => [id, name]));
  const hostnameOf = ({ domainId, name }: DnsRecordView) => {
    const domain = domainNames.get(domainId);
    return domain === undefined || name === '@' ? domain : `${name}.${domain}`;
  };
  const resolvable = dnsRecords.filter((record) => record.view === view
    && (record.type === 'A' || record.type === 'AAAA' || record.type === 'CNAME'));
  const byName = groupBy(resolvable, hostnameOf);

  const collected = new Map<string, { hostnames: Set<string>; recordIds: Set<string> }>();
  for (const hostname of byName.keys()) {
    if (hostname === undefined) {
      continue;
    }
    const distance = new Map([[hostname, 0]]);
    const queue = [hostname];
    const followed: string[] = [];
    const addresses: DnsRecordView[] = [];
    for (const name of queue) {
      const steps = distance.get(name) ?? 0;
      for (const record of byName.get(name) ?? []) {
        if (record.type !== 'CNAME') {
          addresses.push(record);
        } else if (steps < MAX_CNAME_STEPS) {
          followed.push(record.id);
          if (!distance.has(record.value)) {
            distance.set(record.value, steps + 1);
            queue.push(record.value);
          }
        }
      }
    }
    for (const { id, value } of addresses) {
      const names = collected.get(value) ?? { hostnames: new Set<string>(), recordIds: new Set<string>() };
      names.hostnames.add(hostname);
      for (const recordId of [...followed, id]) {
        names.recordIds.add(recordId);
      }
      collected.set(value, names);
    }
  }
  return new Map([...collected].map(([address, { hostnames, recordIds }]) =>
    [address, { hostnames: [...hostnames].sort(), recordIds: [...recordIds].sort() }]));
}

/** Client entry flows: from a record's view's client to each listener reachable at the address it leads to. */
export function deriveDnsFlows(entities: DnsFlowEntities): FlowDraft[] {
  // Per view and listener, every hostname and record that reaches it, from all of its addresses.
  type EntryFlow = { view: DnsView; listenerId: string; hostnames: Set<string>; recordIds: Set<string> };
  const flows = new Map<string, EntryFlow>();
  for (const view of DNS_VIEWS) {
    for (const [address, names] of dnsNamesByAddress(entities, view)) {
      for (const { id: listenerId } of reachableListeners(entities, address)) {
        const key = `${view}:${listenerId}`;
        const flow = flows.get(key) ?? { view, listenerId, hostnames: new Set<string>(), recordIds: new Set<string>() };
        names.hostnames.forEach((hostname) => flow.hostnames.add(hostname));
        names.recordIds.forEach((recordId) => flow.recordIds.add(recordId));
        flows.set(key, flow);
      }
    }
  }
  return [...flows].sort(([a], [b]) => a.localeCompare(b)).map(([key, { view, listenerId, hostnames, recordIds }]) => ({
    key,
    source: { client: view },
    targetListenerId: listenerId,
    hostnames: [...hostnames].sort(),
    basis: [...recordIds].map((id) => ({ entity: 'dns-record', id })),
  }));
}

export const dnsFlowDeriver: FlowDeriver = {
  id: 'dns',
  derive: async ({ read }) => {
    const [domains, dnsRecords, hosts, services, listeners] = await Promise.all([
      read.domains.list(), read.dnsRecords.list(), read.hosts.list(), read.services.list(), read.listeners.list(),
    ]);
    return deriveDnsFlows({ domains, dnsRecords, hosts, services, listeners });
  },
};
