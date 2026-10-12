import { describe, expect, it } from 'vitest';

import { DNS_RECORD_TYPES, dnsRecordSchema, isWildcard } from './dns-record';
import { issuePaths } from '../../tests/support/issues';

const DOMAIN_ID = '0199d6a0-0000-7000-8000-000000000001';

const parse = (input: Record<string, unknown>) =>
  dnsRecordSchema.input.safeParse({ domainId: DOMAIN_ID, name: 'app', type: 'A', value: '203.0.113.10', ...input });

describe('DNS record schema', () => {
  it('accepts names relative to the domain: @, www, *, *.dev, app.dev', () => {
    for (const name of ['@', 'www', '*', '*.dev', 'app.dev', '_dmarc', '_sip._tcp']) {
      expect(parse({ name }).data?.name, name).toBe(name);
    }
    expect(parse({ name: 'WWW' }).data?.name).toBe('www');
    for (const name of ['', 'a..b', 'www.*', '-www', 'w w', 'app.homelab.example.', '@.dev', '\u212Aelvin']) {
      expect(issuePaths(parse({ name })), name).toEqual(['name']);
    }
  });

  it('accepts the types A, AAAA, CNAME, MX, TXT, SRV, NS and CAA, and nothing else', () => {
    expect(DNS_RECORD_TYPES).toEqual(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS', 'CAA']);
    expect(parse({ type: 'TXT', value: 'v=spf1 -all' }).success).toBe(true);
    for (const type of ['PTR', 'a', '']) {
      expect(issuePaths(parse({ type }))).toEqual(['type']);
    }
  });

  it('defaults the view to public and proxied to false', () => {
    expect(parse({}).data).toMatchObject({ view: 'public', proxied: false });
    expect(parse({ view: 'internal', proxied: true }).data).toMatchObject({ view: 'internal', proxied: true });
    expect(issuePaths(parse({ view: 'external' }))).toEqual(['view']);
  });

  it('derives wildcard from a name starting with *', () => {
    expect(isWildcard('*')).toBe(true);
    expect(isWildcard('*.dev')).toBe(true);
    expect(isWildcard('www')).toBe(false);
    expect(isWildcard('@')).toBe(false);
  });

  it('requires an IPv4 value for A and an IPv6 value for AAAA', () => {
    expect(issuePaths(parse({ type: 'A', value: '2001:db8::1' }))).toEqual(['value']);
    expect(parse({ type: 'AAAA', value: '2001:DB8::1' }).data?.value).toBe('2001:db8::1');
    expect(issuePaths(parse({ type: 'AAAA', value: '203.0.113.10' }))).toEqual(['value']);
  });

  it('requires a DNS name value for CNAME and NS, normalized', () => {
    expect(parse({ type: 'CNAME', value: 'HomeLab.Example.' }).data?.value).toBe('homelab.example');
    expect(parse({ type: 'NS', value: 'ns1.homelab.example' }).data?.value).toBe('ns1.homelab.example');
    expect(issuePaths(parse({ type: 'CNAME', value: 'not a name' }))).toEqual(['value']);
    expect(issuePaths(parse({ type: 'NS', value: '' }))).toEqual(['value']);
  });

  it('bounds the value of other types to 4000 characters of text', () => {
    expect(parse({ type: 'MX', value: '10 mail.homelab.example' }).success).toBe(true);
    expect(parse({ type: 'TXT', value: 't'.repeat(4000) }).success).toBe(true);
    expect(issuePaths(parse({ type: 'TXT', value: 't'.repeat(4001) }))).toEqual(['value']);
    expect(issuePaths(parse({ type: 'TXT', value: '' }))).toEqual(['value']);
    expect(issuePaths(parse({ type: 'CAA', value: 'line\nbreak' }))).toEqual(['value']);
  });
});
