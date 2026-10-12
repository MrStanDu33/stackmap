import { dnsRecordRepository } from './dns-records';
import { domainRepository } from './domains';
import { inTransaction } from './entity-repository';
import { hostRepository } from './hosts';
import { listenerRepository } from './listeners';
import { networkRepository } from './networks';
import { serviceRepository } from './services';
import { siteRepository } from './sites';

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

/** The scope is copied and frozen: changing the caller's object afterwards cannot move them to another workspace. */
export function workspaceRepositories(db: Kysely<Database>, scope: RepositoryScope): WorkspaceRepositories {
  const frozen: RepositoryScope = Object.isFrozen(scope) ? scope : Object.freeze({ ...scope });
  const context = { db, scope: frozen };
  return {
    sites: siteRepository(context),
    networks: networkRepository(context),
    hosts: hostRepository(context),
    services: serviceRepository(context),
    listeners: listenerRepository(context),
    domains: domainRepository(context),
    dnsRecords: dnsRecordRepository(context),
    transaction: (work) => inTransaction(db, (trx) => work(workspaceRepositories(trx, frozen))),
  };
}
