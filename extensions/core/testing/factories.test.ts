import { describe, expect, it } from 'vitest';

import {
  buildDnsRecord, buildDomain, buildHost, buildListener, buildNetwork, buildService, buildSite,
} from './factories';
import { isFictionalDnsName, isFictionalIp } from '../../../tests/support/fictional';
import { ENTITY_SCHEMAS } from '../entities';

const BUILDERS = {
  site: buildSite,
  network: buildNetwork,
  host: buildHost,
  service: buildService,
  listener: buildListener,
  domain: buildDomain,
  dnsRecord: buildDnsRecord,
} as const;

const sequenceOf = (name: string) => Number(/\d+$/.exec(name)?.[0]);

describe('factories', () => {
  it('builds valid input for every entity, without a database', () => {
    for (const [entity, build] of Object.entries(BUILDERS)) {
      const { input } = ENTITY_SCHEMAS[entity as keyof typeof BUILDERS];
      expect(input.safeParse(build()).success, entity).toBe(true);
    }
  });

  it('gives deterministic defaults, unique within a run', () => {
    const first = buildSite();
    const second = buildSite();
    expect(first.name).toMatch(/^Site \d+$/);
    expect(sequenceOf(second.name)).toBe(sequenceOf(first.name) + 1);

    const many = Array.from({ length: 300 }, () => [buildDomain().name, buildNetwork().cidr]);
    for (const column of [0, 1]) {
      expect(new Set(many.map((values) => values[column])).size).toBe(300);
    }
  });

  it('applies overrides over the defaults', () => {
    expect(buildHost({ name: 'Edge router', kind: 'router' })).toEqual({ name: 'Edge router', kind: 'router' });
    expect(buildListener({ port: 443 })).toMatchObject({ port: 443, transport: 'tcp' });
  });

  it('uses only fictional IPs (RFC 5737, RFC 1918, 2001:db8::/32, fd00::/8) and DNS names (.example, .test, .invalid)', () => {
    expect([isFictionalIp('203.0.113.10'), isFictionalIp('10.0.10.0/24'), isFictionalIp('2001:db8::1')]).toEqual([true, true, true]);
    expect([isFictionalIp('198.51.99.1'), isFictionalIp('0.0.0.0/0'), isFictionalIp('2a00::1')]).toEqual([false, false, false]);
    expect([isFictionalDnsName('homelab.example'), isFictionalDnsName('homelab.com')]).toEqual([true, false]);

    for (let index = 0; index < 600; index += 1) {
      const network = buildNetwork();
      const record = buildDnsRecord();
      expect(network.cidr && isFictionalIp(network.cidr), network.cidr ?? '').toBe(true);
      expect(isFictionalIp(record.value), record.value).toBe(true);
      expect(isFictionalDnsName(buildDomain().name)).toBe(true);
    }
  });
});
