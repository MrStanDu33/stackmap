import { describe, expect, it } from 'vitest';

import { resolveDnsHops } from './dns';

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

const DOMAIN = { id: id(1), name: 'homelab.example' };
const record = (n: number, name: string, type: 'A' | 'CNAME', value: string, view: 'public' | 'internal' = 'public') =>
  ({ id: id(n), domainId: DOMAIN.id, name, type, value, view });

const APEX = record(10, '@', 'A', '203.0.113.10');
const WWW = record(11, 'www', 'CNAME', 'homelab.example');
const APP = record(12, 'app', 'A', '203.0.113.10');
const DEV = record(13, '*.dev', 'A', '203.0.113.10');
const NAS = record(14, 'nas', 'A', '10.0.10.30', 'internal');

const resolve = (hostname: string, ids: string[]) =>
  resolveDnsHops({ domains: [DOMAIN], dnsRecords: [APEX, WWW, APP, DEV, NAS] }, hostname, ids);

describe('dns-record hop resolver', () => {
  it('given a CNAME → A chain, gives the CNAME hop then the A hop, leaving out the flow\'s records for other names', () => {
    expect(resolve('www.homelab.example', [APEX.id, WWW.id, APP.id])).toEqual([
      {
        entity: 'dns-record', id: WWW.id, stage: 'dns', label: 'extensions.core.trace.alias.public',
        params: { name: 'www.homelab.example', target: 'homelab.example' },
      },
      {
        entity: 'dns-record', id: APEX.id, stage: 'dns', label: 'extensions.core.trace.address.public',
        params: { name: 'homelab.example', address: '203.0.113.10' },
      },
    ]);
    expect(resolve('a.dev.homelab.example', [DEV.id, APP.id])).toEqual([{
      entity: 'dns-record', id: DEV.id, stage: 'dns', label: 'extensions.core.trace.address.public',
      params: { name: '*.dev.homelab.example', address: '203.0.113.10' },
    }]);
  });

  it('names the record\'s view in the label, not in a parameter', () => {
    expect(resolve('nas.homelab.example', [NAS.id])).toEqual([{
      entity: 'dns-record', id: NAS.id, stage: 'dns', label: 'extensions.core.trace.address.internal',
      params: { name: 'nas.homelab.example', address: '10.0.10.30' },
    }]);
  });
});
