import type {
  DnsRecord, DnsRecordInput, Domain, DomainInput, Host, HostInput, Listener, ListenerInput, Network, NetworkInput,
  Service, ServiceInput, Site, SiteInput,
} from '../../extensions/core/entities';
import type { WorkspaceRepositories } from '../repositories';

/**
 * A fictional home lab, with references by name instead of ids: tests use it, and the app seeds it into its demo
 * workspace.
 */
export interface DemoStack {
  sites: Record<string, SiteInput>;
  networks: Record<string, Omit<NetworkInput, 'siteId'> & { site: string | null }>;
  hosts: Record<string, Omit<HostInput, 'siteId' | 'addresses'> & {
    site: string | null;
    addresses: { address: string; network: string | null }[];
  }>;
  services: Record<string, Omit<ServiceInput, 'hostId'> & { host: string | null }>;
  listeners: Record<string, Omit<ListenerInput, 'serviceId'> & { service: string }>;
  domains: Record<string, DomainInput>;
  dnsRecords: Record<string, Omit<DnsRecordInput, 'domainId'> & { domain: string }>;
}

/** The created entities, by the demo stack's references. */
export interface SeededDemoStack {
  sites: Record<string, Site>;
  networks: Record<string, Network>;
  hosts: Record<string, Host>;
  services: Record<string, Service>;
  listeners: Record<string, Listener>;
  domains: Record<string, Domain>;
  dnsRecords: Record<string, DnsRecord>;
}

export const DEMO_STACK: DemoStack = {
  sites: {},
  networks: {},
  hosts: {},
  services: {},
  listeners: {},
  domains: {},
  dnsRecords: {},
};

/** Creates the demo stack in the repositories' workspace, in one transaction. */
export function seedDemoStack(_repos: WorkspaceRepositories): Promise<SeededDemoStack> {
  return Promise.reject(new Error('Not implemented'));
}
