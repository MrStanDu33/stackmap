import { newId } from '../../server/database/ids';
import { createWorkspace as insertWorkspace } from '../../server/repositories/workspaces';

import type { Database } from '../../server/database/types/schema';
import type { WorkspaceRepositories } from '../../server/repositories';
import type {
  DnsRecord, DnsRecordInput, Domain, DomainInput, Host, HostInput, Listener, ListenerInput, Network, NetworkInput,
  Service, ServiceInput, Site, SiteInput, Workspace, WorkspaceInput,
} from '../../shared/entities';
import type { Kysely } from 'kysely';

/*
 * Test data: `buildX` returns valid input without a database, `createX` stores it through the repositories, creating
 * the parents an entity needs. Defaults are deterministic and unique within a run, and only use fictional values:
 * documentation and private IP ranges, `.example` DNS names.
 */

let sequence = 0;
const next = () => {
  sequence += 1;
  return sequence;
};

export function buildWorkspace(overrides: Partial<WorkspaceInput> = {}): WorkspaceInput {
  const n = next();
  return { name: `Workspace ${String(n)}`, slug: `workspace-${String(n)}`, ...overrides };
}

export function buildSite(overrides: Partial<SiteInput> = {}): SiteInput {
  return { name: `Site ${String(next())}`, ...overrides };
}

export function buildNetwork(overrides: Partial<NetworkInput> = {}): NetworkInput {
  const n = next();
  const cidr = `10.${String(Math.floor(n / 256) % 256)}.${String(n % 256)}.0/24`;
  return { name: `Network ${String(n)}`, kind: 'lan', cidr, ...overrides };
}

export function buildHost(overrides: Partial<HostInput> = {}): HostInput {
  return { name: `Host ${String(next())}`, kind: 'vm', ...overrides };
}

export function buildService(overrides: Partial<ServiceInput> = {}): ServiceInput {
  return { name: `Service ${String(next())}`, kind: 'app', ...overrides };
}

export function buildListener(overrides: Partial<ListenerInput> = {}): ListenerInput {
  return { serviceId: newId(), port: 1024 + (next() % 60_000), transport: 'tcp', ...overrides };
}

export function buildDomain(overrides: Partial<DomainInput> = {}): DomainInput {
  return { name: `domain-${String(next())}.example`, ...overrides };
}

export function buildDnsRecord(overrides: Partial<DnsRecordInput> = {}): DnsRecordInput {
  const n = next();
  const value = `192.0.2.${String((n % 254) + 1)}`;
  return { domainId: newId(), name: `host-${String(n)}`, type: 'A', value, ...overrides };
}

type Overrides<T> = Partial<T>;

export function createWorkspace(db: Kysely<Database>, overrides: Overrides<WorkspaceInput> = {}): Promise<Workspace> {
  return insertWorkspace(db, buildWorkspace(overrides));
}

export function createSite(repos: WorkspaceRepositories, overrides: Overrides<SiteInput> = {}): Promise<Site> {
  return repos.sites.create(buildSite(overrides));
}

export function createNetwork(repos: WorkspaceRepositories, overrides: Overrides<NetworkInput> = {}): Promise<Network> {
  return repos.networks.create(buildNetwork(overrides));
}

export function createHost(repos: WorkspaceRepositories, overrides: Overrides<HostInput> = {}): Promise<Host> {
  return repos.hosts.create(buildHost(overrides));
}

export function createService(repos: WorkspaceRepositories, overrides: Overrides<ServiceInput> = {}): Promise<Service> {
  return repos.services.create(buildService(overrides));
}

/** Creates a service for the listener unless one is given. */
export async function createListener(
  repos: WorkspaceRepositories,
  overrides: Overrides<ListenerInput> = {},
): Promise<Listener> {
  const serviceId = overrides.serviceId ?? (await createService(repos)).id;
  return repos.listeners.create(buildListener({ ...overrides, serviceId }));
}

export function createDomain(repos: WorkspaceRepositories, overrides: Overrides<DomainInput> = {}): Promise<Domain> {
  return repos.domains.create(buildDomain(overrides));
}

/** Creates a domain for the record unless one is given. */
export async function createDnsRecord(
  repos: WorkspaceRepositories,
  overrides: Overrides<DnsRecordInput> = {},
): Promise<DnsRecord> {
  const domainId = overrides.domainId ?? (await createDomain(repos)).id;
  return repos.dnsRecords.create(buildDnsRecord({ ...overrides, domainId }));
}

/** One of every entity in a workspace, a host address and a DNS record included. */
export async function populateWorkspace(repos: WorkspaceRepositories): Promise<void> {
  const site = await createSite(repos);
  const network = await createNetwork(repos, { siteId: site.id, cidr: '10.0.10.0/24' });
  const host = await createHost(repos, { siteId: site.id, addresses: [{ address: '10.0.10.20', networkId: network.id }] });
  const service = await createService(repos, { hostId: host.id });
  await createListener(repos, { serviceId: service.id });
  await createDnsRecord(repos);
}
