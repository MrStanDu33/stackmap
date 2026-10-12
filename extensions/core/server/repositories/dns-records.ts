import type { DnsRecord, DnsRecordInput, DnsRecordPatch } from '../../entities';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';

export type DnsRecordRepository = ScopedRepository<DnsRecord, DnsRecordInput, DnsRecordPatch, { domainId?: string }>;
