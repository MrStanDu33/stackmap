import type { ScopedRepository } from './entity-repository';
import type { DnsRecord, DnsRecordInput, DnsRecordPatch } from '../../shared/entities';

export type DnsRecordRepository = ScopedRepository<DnsRecord, DnsRecordInput, DnsRecordPatch, { domainId?: string }>;
