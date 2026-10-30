import type { DnsRecord, Domain, Host, Listener, Service } from '../../entities';
import type { FlowClient, FlowDeriver, FlowDraft } from '@stackmap/extension-sdk/server';

/** What the DNS deriver reads: the workspace's records and what their addresses lead to. */
export interface DnsFlowEntities {
  domains: readonly Pick<Domain, 'id' | 'name'>[];
  dnsRecords: readonly Pick<DnsRecord, 'id' | 'domainId' | 'name' | 'type' | 'value' | 'view'>[];
  hosts: readonly Pick<Host, 'id' | 'addresses'>[];
  services: readonly Pick<Service, 'id' | 'hostId'>[];
  listeners: readonly Pick<Listener, 'id' | 'serviceId' | 'bindAddress'>[];
}

type DnsRecordView = DnsFlowEntities['dnsRecords'][number];
type DnsView = DnsRecordView['view'];

/** How many CNAMEs a name may go through before it reaches an address, as resolvers cap it. */
const MAX_CNAME_STEPS = 8;

/** The bind address that accepts every address of the record's IP version. */
const ANY_ADDRESS: Partial<Record<DnsRecordView['type'], string>> = { A: '0.0.0.0', AAAA: '::' };

/** A client entry flow being collected: every hostname and record that reaches the listener. */
interface EntryFlow {
  client: FlowClient;
  listenerId: string;
  hostnames: Set<string>;
  basis: Set<string>;
}

const groupBy = <T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> => {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item]);
  }
  return groups;
};

/** Client entry flows: from a record's view's client to each listener reachable at the address it leads to. */
export function deriveDnsFlows({ domains, dnsRecords, hosts, services, listeners }: DnsFlowEntities): FlowDraft[] {
  const domainNames = new Map(domains.map(({ id, name }) => [id, name]));
  const hostnameOf = ({ domainId, name }: DnsRecordView) => {
    const domain = domainNames.get(domainId);
    return domain === undefined || name === '@' ? domain : `${name}.${domain}`;
  };
  const resolvable = dnsRecords.filter(({ type }) => type === 'A' || type === 'AAAA' || type === 'CNAME');
  // A CNAME resolves through records of its own view only, as a split-horizon resolver does.
  const byName = groupBy(resolvable, (record) => `${record.view} ${hostnameOf(record) ?? ''}`);
  const hostAddresses = hosts.flatMap(({ id, addresses }) => addresses.map(({ address }) => ({ id, address })));
  const hostsByAddress = groupBy(hostAddresses, ({ address }) => address);
  const servicesByHost = groupBy(services, ({ hostId }) => hostId);
  const listenersByService = groupBy(listeners, ({ serviceId }) => serviceId);

  /**
   * The address records a name leads to, and the CNAMEs followed on the way: each name visited once, at its shortest
   * distance, so a dense CNAME graph costs its size, not its number of paths.
   */
  const resolve = (view: DnsView, hostname: string) => {
    const distance = new Map([[hostname, 0]]);
    const queue = [hostname];
    const addresses: DnsRecordView[] = [];
    const followed: DnsRecordView[] = [];
    for (const name of queue) {
      const steps = distance.get(name) ?? 0;
      for (const record of byName.get(`${view} ${name}`) ?? []) {
        if (record.type !== 'CNAME') {
          addresses.push(record);
        } else if (steps < MAX_CNAME_STEPS) {
          followed.push(record);
          if (!distance.has(record.value)) {
            distance.set(record.value, steps + 1);
            queue.push(record.value);
          }
        }
      }
    }
    return { addresses, followed };
  };

  /** The listeners reachable at an address record's address. */
  const reachable = ({ type, value }: DnsRecordView) => (hostsByAddress.get(value) ?? [])
    .flatMap(({ id }) => servicesByHost.get(id) ?? [])
    .flatMap(({ id }) => listenersByService.get(id) ?? [])
    .filter(({ bindAddress }) => bindAddress === value || bindAddress === ANY_ADDRESS[type]);

  const flows = new Map<string, EntryFlow>();
  const names = new Map(resolvable.flatMap((record) => {
    const hostname = hostnameOf(record);
    return hostname === undefined ? [] : [[`${record.view} ${hostname}`, { view: record.view, hostname }] as const];
  }));
  for (const { view, hostname } of names.values()) {
    const { addresses, followed } = resolve(view, hostname);
    for (const address of addresses) {
      for (const listener of reachable(address)) {
        const key = `${view}:${listener.id}`;
        const flow = flows.get(key)
          ?? { client: view, listenerId: listener.id, hostnames: new Set<string>(), basis: new Set<string>() };
        flow.hostnames.add(hostname);
        for (const { id } of [...followed, address]) {
          flow.basis.add(id);
        }
        flows.set(key, flow);
      }
    }
  }
  return [...flows].sort(([a], [b]) => a.localeCompare(b)).map(([key, { client, listenerId, hostnames, basis }]) => ({
    key,
    source: { client },
    targetListenerId: listenerId,
    hostnames: [...hostnames].sort(),
    basis: [...basis].map((id) => ({ entity: 'dns-record', id })),
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
