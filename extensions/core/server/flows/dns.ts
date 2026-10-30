import type { DnsRecord, Domain, Host, Listener, Service } from '../../entities';
import type { FlowDeriver, FlowDraft } from '@stackmap/extension-sdk/server';

/** What the DNS deriver reads: the workspace's records and what their addresses lead to. */
export interface DnsFlowEntities {
  domains: readonly Pick<Domain, 'id' | 'name'>[];
  dnsRecords: readonly Pick<DnsRecord, 'id' | 'domainId' | 'name' | 'type' | 'value' | 'view'>[];
  hosts: readonly Pick<Host, 'id' | 'addresses'>[];
  services: readonly Pick<Service, 'id' | 'hostId'>[];
  listeners: readonly Pick<Listener, 'id' | 'serviceId' | 'bindAddress'>[];
}

/** Client entry flows: from a record's view's client to each listener reachable at the address it leads to. */
export function deriveDnsFlows(_entities: DnsFlowEntities): FlowDraft[] {
  throw new Error('Not implemented');
}

export const dnsFlowDeriver: FlowDeriver = {
  id: 'dns',
  derive: () => Promise.reject(new Error('Not implemented')),
};
