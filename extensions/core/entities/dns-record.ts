import { ASCII, defineEntitySchema, whenValid, entityId, line, normalizeDnsName, normalizeIp } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

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

/** `@`, or labels relative to the domain; `*` only as the first label, `_` only to start one (`_dmarc`). */
const RECORD_LABEL = /^(?:_?(?!-)[a-z0-9-]{1,63}(?<!-))$/;

const isRecordName = (text: string) => {
  const name = text.toLowerCase();
  return ASCII.test(text) && (name === '@'
    || name.split('.').every((label, index) => RECORD_LABEL.test(label) || (index === 0 && label === '*')));
};

const recordName = () => z.string().min(1).max(253).regex(/^[\w*.@-]*$/)
  .refine(isRecordName, {
    message: 'Expected @ or a name relative to the domain, such as www or *.dev', params: { code: 'core.invalid-record-name' },
    when: whenValid,
  })
  .overwrite((text) => text.toLowerCase());

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
  domainId: entityId().meta({ description: 'The domain the record belongs to', examples: ['0199d6a0-0000-7000-8000-000000000004'] }),
  name: recordName().meta({ description: 'The name relative to the domain, @ for the domain itself', examples: ['blog'] }),
  type: z.enum(DNS_RECORD_TYPES).meta({ description: 'The record type', examples: ['A'] }),
  value: line(4000).min(1).meta({ description: 'The record\'s value, checked against its type', examples: ['192.0.2.20'] }),
  view: z.enum(DNS_VIEWS).default('public').meta({ description: 'Where the record resolves', examples: ['public'] }),
  proxied: z.boolean().default(false).meta({ description: 'Whether a proxy in front of the DNS answers instead of the value', examples: [false] }),
}, (record: DnsRecordFields, context) => {
  const value = normalizeValue(record.type, record.value);
  if (value === undefined) {
    context.addIssue({ code: 'custom', path: ['value'], message: `A ${record.type} record points to ${EXPECTED_VALUE[record.type]}`, params: { code: 'core.invalid-record-value', type: record.type } });
    return record;
  }
  return { ...record, value };
});

/** Whether a record name covers every name at its level: `*`, `*.dev`. */
export function isWildcard(name: string): boolean {
  return name === '*' || name.startsWith('*.');
}
