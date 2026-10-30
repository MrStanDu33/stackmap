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
  const byHostname = groupBy(resolvable, hostnameOf);
  const servicesByHost = groupBy(services, ({ hostId }) => hostId);
  const listenersByService = groupBy(listeners, ({ serviceId }) => serviceId);

  /** The address records a record leads to, each with the records on the way. */
  const addressesOf = (record: DnsRecordView, path: DnsRecordView[] = []): DnsRecordView[][] => {
    if (record.type !== 'CNAME') {
      return [[...path, record]];
    }
    if (path.length >= MAX_CNAME_STEPS || path.includes(record)) {
      return [];
    }
    return (byHostname.get(record.value) ?? []).flatMap((next) => addressesOf(next, [...path, record]));
  };

  /** The listeners reachable at an address record's address. */
  const reachable = ({ type, value }: DnsRecordView) => hosts
    .filter(({ addresses }) => addresses.some(({ address }) => address === value))
    .flatMap(({ id }) => servicesByHost.get(id) ?? [])
    .flatMap(({ id }) => listenersByService.get(id) ?? [])
    .filter(({ bindAddress }) => bindAddress === value || bindAddress === ANY_ADDRESS[type]);

  const flows = new Map<string, EntryFlow>();
  for (const record of resolvable) {
    const hostname = hostnameOf(record);
    if (hostname === undefined) {
      continue;
    }
    for (const path of addressesOf(record)) {
      for (const listener of path.slice(-1).flatMap(reachable)) {
        const key = `${record.view}:${listener.id}`;
        const flow = flows.get(key)
          ?? { client: record.view, listenerId: listener.id, hostnames: new Set<string>(), basis: new Set<string>() };
        flow.hostnames.add(hostname);
        for (const { id } of path) {
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
