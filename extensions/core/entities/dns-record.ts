import { unimplementedSchema } from '@stackmap/extension-sdk/entities';

import type { CommonFields, CommonInput, EntityMeta, EntitySchema } from '@stackmap/extension-sdk/entities';

export const DNS_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS', 'CAA'] as const;
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

export const DNS_VIEWS = ['public', 'internal'] as const;
export type DnsView = (typeof DNS_VIEWS)[number];

export interface DnsRecordFields extends CommonFields {
  domainId: string;
  /** Relative to the domain: `@` for the apex, `www`, `*.dev`. */
  name: string;
  type: DnsRecordType;
  value: string;
  view: DnsView;
  /** Proxied by a CDN. */
  proxied: boolean;
}

export type DnsRecord = EntityMeta & DnsRecordFields & { wildcard: boolean };
export type DnsRecordInput = CommonInput & {
  domainId: string;
  name: string;
  type: DnsRecordType;
  value: string;
  view?: DnsView;
  proxied?: boolean;
};
export type DnsRecordPatch = Partial<DnsRecordInput>;

export const dnsRecordSchema: EntitySchema<DnsRecordFields, DnsRecordInput> = unimplementedSchema();

export function isWildcard(_name: string): boolean {
  throw new Error('Not implemented');
}
