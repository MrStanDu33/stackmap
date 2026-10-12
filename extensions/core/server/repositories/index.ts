import type { DnsRecordRepository } from './dns-records';
import type { DomainRepository } from './domains';
import type { HostRepository } from './hosts';
import type { ListenerRepository } from './listeners';
import type { NetworkRepository } from './networks';
import type { ServiceRepository } from './services';
import type { SiteRepository } from './sites';

declare module '@stackmap/extension-sdk/server' {
  interface EntityRepositories {
    sites: SiteRepository;
    networks: NetworkRepository;
    hosts: HostRepository;
    services: ServiceRepository;
    listeners: ListenerRepository;
    domains: DomainRepository;
    dnsRecords: DnsRecordRepository;
  }
}

export type {
  DnsRecordRepository, DomainRepository, HostRepository, ListenerRepository, NetworkRepository, ServiceRepository,
  SiteRepository,
};
