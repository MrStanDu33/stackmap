import { defineEntityRepository } from './entity-repository';
import { dnsRecordSchema, isWildcard } from '../../shared/entities';

import type { ScopedRepository } from './entity-repository';
import type { DnsRecord, DnsRecordFields, DnsRecordInput, DnsRecordPatch } from '../../shared/entities';

type DnsRecordFilter = { domainId?: string };

export type DnsRecordRepository = ScopedRepository<DnsRecord, DnsRecordInput, DnsRecordPatch, DnsRecordFilter>;

export const dnsRecordRepository = defineEntityRepository<
  DnsRecord, DnsRecordFields, DnsRecordInput, DnsRecordPatch, DnsRecordFilter
>({
  table: 'dnsRecord',
  schema: dnsRecordSchema,
  columns: ['domainId', 'name', 'type', 'value', 'view', 'proxied'],
  booleans: ['proxied'],
  filters: ['domainId'],
  references: ({ domainId }) => [{ field: 'domainId', table: 'domain', id: domainId }],
  expand: (_context, records) =>
    Promise.resolve(records.map((record) => ({ ...record, wildcard: isWildcard(record.name as string) }))),
});
