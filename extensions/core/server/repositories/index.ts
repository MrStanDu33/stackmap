import { dnsRecordRepository } from './dns-records';
import { domainRepository } from './domains';
import { hostRepository } from './hosts';
import { listenerRepository } from './listeners';
import { networkRepository } from './networks';
import { serviceRepository } from './services';
import { siteRepository } from './sites';

import type { DnsRecordRepository } from './dns-records';
import type { DomainRepository } from './domains';
import type { FlowRepository } from './flows';
import type { HostRepository } from './hosts';
import type { ListenerRepository } from './listeners';
import type { NetworkRepository } from './networks';
import type { ServiceRepository } from './services';
import type { SiteRepository } from './sites';
import type { EntityRepositoryDefinition } from '@stackmap/extension-sdk/server';

declare module '@stackmap/extension-sdk/server' {
  interface EntityRepositories {
    sites: SiteRepository;
    networks: NetworkRepository;
    hosts: HostRepository;
    services: ServiceRepository;
    listeners: ListenerRepository;
    domains: DomainRepository;
    dnsRecords: DnsRecordRepository;
    flows: FlowRepository;
  }
}

export type {
  DnsRecordRepository, DomainRepository, FlowRepository, HostRepository, ListenerRepository, NetworkRepository,
  ServiceRepository, SiteRepository,
};

/** The core's repository definitions, one per entity its manifest declares. */
export const REPOSITORIES: readonly EntityRepositoryDefinition[] = [
  siteRepository, networkRepository, hostRepository, serviceRepository, listenerRepository, domainRepository,
  dnsRecordRepository,
] as readonly EntityRepositoryDefinition[];
