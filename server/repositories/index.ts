import type { DnsRecordRepository } from './dns-records';
import type { DomainRepository } from './domains';
import type { RepositoryScope } from './entity-repository';
import type { HostRepository } from './hosts';
import type { ListenerRepository } from './listeners';
import type { NetworkRepository } from './networks';
import type { ServiceRepository } from './services';
import type { SiteRepository } from './sites';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

export type { KindCatalog, RepositoryScope, ScopedRepository } from './entity-repository';

/** The repositories of one workspace: the only way to read or write its entities. */
export interface WorkspaceRepositories {
  sites: SiteRepository;
  networks: NetworkRepository;
  hosts: HostRepository;
  services: ServiceRepository;
  listeners: ListenerRepository;
  domains: DomainRepository;
  dnsRecords: DnsRecordRepository;
  /** Runs the work with repositories of the same workspace on one transaction: all of it is kept, or none. */
  transaction: <T>(work: (repos: WorkspaceRepositories) => Promise<T>) => Promise<T>;
}

export function workspaceRepositories(_db: Kysely<Database>, _scope: RepositoryScope): WorkspaceRepositories {
  throw new Error('Not implemented');
}
