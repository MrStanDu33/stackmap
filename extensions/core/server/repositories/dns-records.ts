import { defineEntityRepository } from '@stackmap/extension-sdk/server';

import { dnsRecordSchema, isWildcard } from '../../entities';

import type { DnsRecord, DnsRecordFields, DnsRecordInput, DnsRecordPatch } from '../../entities';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';

export type DnsRecordRepository = ScopedRepository<DnsRecord, DnsRecordInput, DnsRecordPatch, { domainId?: string }>;

export const dnsRecordRepository = defineEntityRepository<DnsRecordFields, DnsRecordInput>({
  entity: 'dns-record',
  key: 'dnsRecords',
  table: 'core_dnsRecord',
  schema: dnsRecordSchema,
  columns: ['domainId', 'name', 'type', 'value', 'view', 'proxied'],
  booleans: ['proxied'],
  filters: ['domainId'],
  references: ({ domainId }) => [{ field: 'domainId', table: 'core_domain', id: domainId }],
  expand: (_context, records) =>
    Promise.resolve(records.map((record) => ({ ...record, wildcard: isWildcard(record.name as string) }))),
});
