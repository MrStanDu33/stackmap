import { z } from 'zod';

import { defineEntitySchema, entityId, line } from './common';
import { ASCII, normalizeDnsName, normalizeIp } from './network-values';

import type { CommonFields, CommonInput, EntityMeta, EntitySchema } from './common';

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

/** `@`, or labels relative to the domain; `*` only as the first label, `_` only to start one (`_dmarc`). */
const RECORD_LABEL = /^(?:_?(?!-)[a-z0-9-]{1,63}(?<!-))$/;

const recordName = () => z.string().min(1).max(253).transform((text, context) => {
  const name = text.toLowerCase();
  const labels = name.split('.');
  const valid = ASCII.test(text) && (name === '@'
    || labels.every((label, index) => RECORD_LABEL.test(label) || (index === 0 && label === '*')));
  if (!valid) {
    context.addIssue({ code: 'custom', message: 'Expected @ or a name relative to the domain, such as www or *.dev' });
    return z.NEVER;
  }
  return name;
});

const IP_VERSION = { A: 4, AAAA: 6 } as const;

/** The value in canonical form for its type, or undefined when it does not fit the type. */
function normalizeValue(type: DnsRecordType, value: string): string | undefined {
  if (type === 'A' || type === 'AAAA') {
    const address = normalizeIp(value);
    return address !== undefined && address.includes(':') === (IP_VERSION[type] === 6) ? address : undefined;
  }
  if (type === 'CNAME' || type === 'NS') {
    return normalizeDnsName(value);
  }
  return line(4000).safeParse(value).success ? value : undefined;
}

const EXPECTED_VALUE: Record<DnsRecordType, string> = {
  A: 'an IPv4 address',
  AAAA: 'an IPv6 address',
  CNAME: 'a DNS name',
  NS: 'a DNS name',
  MX: 'one line of text',
  TXT: 'one line of text',
  SRV: 'one line of text',
  CAA: 'one line of text',
};

export const dnsRecordSchema: EntitySchema<DnsRecordFields, DnsRecordInput> = defineEntitySchema({
  domainId: entityId(),
  name: recordName(),
  type: z.enum(DNS_RECORD_TYPES),
  value: z.string().min(1).max(4000),
  view: z.enum(DNS_VIEWS).default('public'),
  proxied: z.boolean().default(false),
}, (record: DnsRecordFields, context) => {
  const value = normalizeValue(record.type, record.value);
  if (value === undefined) {
    context.addIssue({ code: 'custom', path: ['value'], message: `A ${record.type} record points to ${EXPECTED_VALUE[record.type]}` });
    return record;
  }
  return { ...record, value };
});

/** Whether a record name covers every name at its level: `*`, `*.dev`. */
export function isWildcard(name: string): boolean {
  return name === '*' || name.startsWith('*.');
}
