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
export const MAX_CNAME_STEPS = 8;

const groupBy = <T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> => {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item]);
  }
  return groups;
};

/** A host holding an address, and the network it holds it on when documented. */
export interface AddressHolder {
  hostId: string;
  networkId: string | null;
}

/**
 * Looks up the listeners reachable at an address, from indexes built once: on the hosts holding it (those `accepts`
 * keeps), bound to it or to every address of its IP version. A null bind address (container network, external
 * service) is never reachable.
 */
export function listenerIndex<L extends DnsFlowEntities['listeners'][number]>(
  { hosts, services, listeners }: Pick<DnsFlowEntities, 'hosts' | 'services'> & { listeners: readonly L[] },
): (address: string, accepts?: (holder: AddressHolder) => boolean) => L[] {
  const holders = groupBy(hosts.flatMap(({ id, addresses }) =>
    addresses.map(({ address, networkId }) => ({ address, hostId: id, networkId }))), ({ address }) => address);
  const servicesByHost = groupBy(services, ({ hostId }) => hostId);
  const listenersByService = groupBy(listeners, ({ serviceId }) => serviceId);
  return (address, accepts = () => true) => {
    const any = address.includes(':') ? '::' : '0.0.0.0';
    return (holders.get(address) ?? []).filter(accepts)
      .flatMap(({ hostId }) => servicesByHost.get(hostId) ?? [])
      .flatMap(({ id }) => listenersByService.get(id) ?? [])
      .filter(({ bindAddress }) => bindAddress === address || bindAddress === any);
  };
}

/** The listeners reachable at one address; build a `listenerIndex` to look up many. */
export function reachableListeners<L extends DnsFlowEntities['listeners'][number]>(
  entities: Pick<DnsFlowEntities, 'hosts' | 'services'> & { listeners: readonly L[] },
  address: string,
): L[] {
  return listenerIndex(entities)(address);
}

/**
 * For each address, the hostnames of a view resolving to it: A/AAAA records, and CNAMEs of the same view leading to
 * them (as a split-horizon resolver does). Each name is resolved once per CNAME budget, so a dense CNAME graph costs
 * about its size, not its number of paths.
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

  // What a name resolves to with a number of CNAME steps left, memoized: a name is resolved once per budget, not once
  // per path, so a dense or fanned-out CNAME graph costs about its size.
  interface Resolution {
    /** Address → the A/AAAA records reached for it. */
    addresses: Map<string, Set<string>>;
    cnames: string[];
    via: Resolution[];
  }
  const memo = new Map<string, Resolution>();
  const resolveName = (name: string, budget: number): Resolution => {
    const key = `${String(budget)} ${name}`;
    const known = memo.get(key);
    if (known) {
      return known;
    }
    const records = byName.get(name) ?? [];
    const resolution: Resolution = { addresses: new Map(), cnames: [], via: [] };
    for (const record of records) {
      if (record.type !== 'CNAME') {
        resolution.addresses.set(record.value, (resolution.addresses.get(record.value) ?? new Set()).add(record.id));
      } else if (budget > 0) {
        resolution.cnames.push(record.id);
        resolution.via.push(resolveName(record.value, budget - 1));
      }
    }
    const [only] = resolution.via;
    if (resolution.addresses.size === 0 && resolution.via.length === 1 && only) {
      // A plain alias shares its target's addresses instead of copying them.
      resolution.addresses = only.addresses;
    } else {
      // Aliases of one name share its addresses: each distinct set is merged once.
      for (const addresses of new Set(resolution.via.map((next) => next.addresses))) {
        for (const [address, ids] of addresses) {
          const merged = resolution.addresses.get(address) ?? new Set<string>();
          ids.forEach((id) => merged.add(id));
          resolution.addresses.set(address, merged);
        }
      }
    }
    memo.set(key, resolution);
    return resolution;
  };
  /** Every CNAME followed from some resolutions, each resolution walked once however many names lead to it. */
  const followedFrom = (resolutions: Iterable<Resolution>): Set<string> => {
    const seen = new Set<Resolution>();
    const followed = new Set<string>();
    const stack = [...resolutions];
    for (let next = stack.pop(); next; next = stack.pop()) {
      if (!seen.has(next)) {
        seen.add(next);
        next.cnames.forEach((id) => followed.add(id));
        stack.push(...next.via);
      }
    }
    return followed;
  };

  // Names grouped by the addresses they share, so each shared set is walked once, not once per alias.
  interface Group {
    index: number;
    addresses: Map<string, Set<string>>;
    names: Map<string, Resolution>;
  }
  const byAddresses = new Map<Map<string, Set<string>>, Group>();
  for (const hostname of byName.keys()) {
    if (hostname === undefined) {
      continue;
    }
    const resolution = resolveName(hostname, MAX_CNAME_STEPS);
    const group = byAddresses.get(resolution.addresses)
      ?? { index: byAddresses.size, addresses: resolution.addresses, names: new Map() };
    byAddresses.set(resolution.addresses, group);
    group.names.set(hostname, resolution);
  }
  const reaching = new Map<string, Group[]>();
  for (const group of byAddresses.values()) {
    for (const address of group.addresses.keys()) {
      const groups = reaching.get(address) ?? [];
      reaching.set(address, groups);
      groups.push(group);
    }
  }
  // Addresses reached by the same groups share their CNAMEs: walked once for all of them, whatever the groups overlap.
  const followedByGroups = new Map<string, Set<string>>();
  return new Map([...reaching].map(([address, groups]) => {
    let recordIds: string[] | undefined;
    return [address, {
      hostnames: groups.flatMap(({ names }) => [...names.keys()]).sort(),
      // Built on first use: callers only ask for the addresses that lead somewhere.
      get recordIds() {
        if (recordIds === undefined) {
          const key = groups.map(({ index }) => index).join(' ');
          const followed = followedByGroups.get(key)
            ?? followedFrom(groups.flatMap(({ names }) => [...names.values()]));
          followedByGroups.set(key, followed);
          const records = groups.flatMap((group) => [...(group.addresses.get(address) ?? [])]);
          recordIds = [...new Set([...followed, ...records])].sort();
        }
        return recordIds;
      },
    }];
  }));
}

/** Client entry flows: from a record's view's client to each listener reachable at the address it leads to. */
export function deriveDnsFlows(entities: DnsFlowEntities): FlowDraft[] {
  // Per view and listener, every hostname and record that reaches it, from all of its addresses.
  type EntryFlow = { view: DnsView; listenerId: string; hostnames: Set<string>; recordIds: Set<string> };
  const flows = new Map<string, EntryFlow>();
  const listenersAt = listenerIndex(entities);
  for (const view of DNS_VIEWS) {
    for (const [address, names] of dnsNamesByAddress(entities, view)) {
      for (const { id: listenerId } of listenersAt(address)) {
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
