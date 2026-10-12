import { describe, expect, it } from 'vitest';

import { cidr, cidrContains, dnsName, ipAddress, ipv4Address, ipv6Address, normalizeIp } from './network-values';
import { issueMessages } from '../../tests/support/issues';

describe('IP addresses', () => {
  it('accepts IPv4 and IPv6 addresses and refuses anything else', () => {
    for (const address of ['10.0.10.20', '192.0.2.1', '0.0.0.0', '255.255.255.255', '2001:db8::1', '::', '::1', 'fe80::1']) {
      expect(ipAddress().safeParse(address).success, address).toBe(true);
    }
    for (const text of [
      '', '10.0.10', '10.0.10.256', '010.0.10.1', '10.0.10.1/24', ' 10.0.10.1', '2001:db8:::1', '2001:db8::1::2',
      '12345::1', '1:2:3:4:5:6:7:8:9', 'fe80::1%eth0', 'homelab.example',
    ]) {
      expect(ipAddress().safeParse(text).success, text).toBe(false);
      expect(normalizeIp(text), text).toBeUndefined();
    }
    expect(ipv4Address().safeParse('2001:db8::1').success).toBe(false);
    expect(ipv6Address().safeParse('10.0.10.1').success).toBe(false);
  });

  it('normalizes IPv6: lowercased and compressed', () => {
    expect(ipAddress().parse('2001:DB8:0:0::1')).toBe('2001:db8::1');
    expect(normalizeIp('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1');
    // RFC 5952: the longest run of zero groups is compressed, the first one on a tie, never a single group.
    expect(normalizeIp('2001:db8:0:0:1:0:0:1')).toBe('2001:db8::1:0:0:1');
    expect(normalizeIp('2001:db8:0:0:0:1:0:0')).toBe('2001:db8::1:0:0');
    expect(normalizeIp('2001:db8:0:1:1:1:1:1')).toBe('2001:db8:0:1:1:1:1:1');
    expect(normalizeIp('0:0:0:0:0:0:0:0')).toBe('::');
    expect(normalizeIp('::0:1')).toBe('::1');
    expect(normalizeIp('10.0.10.20')).toBe('10.0.10.20');
  });

  it('keeps an IPv4-mapped IPv6 address as given, not as the IPv4 address', () => {
    expect(normalizeIp('::FFFF:10.0.10.20')).toBe('::ffff:10.0.10.20');
    expect(ipv6Address().safeParse('::ffff:10.0.10.20').success).toBe(true);
    expect(ipv4Address().safeParse('::ffff:10.0.10.20').success).toBe(false);
    expect(cidrContains('10.0.10.0/24', '::ffff:10.0.10.20')).toBe(false);
  });
});

describe('CIDRs', () => {
  it('accepts IPv4 and IPv6 networks and normalizes them', () => {
    expect(cidr().parse('10.0.10.0/24')).toBe('10.0.10.0/24');
    expect(cidr().parse('2001:DB8::/48')).toBe('2001:db8::/48');
    expect(cidr().parse('0.0.0.0/0')).toBe('0.0.0.0/0');
    expect(cidr().parse('10.0.10.20/32')).toBe('10.0.10.20/32');
    for (const text of ['10.0.10.0', '10.0.10.0/33', '2001:db8::/129', '10.0.10.0/024', '10.0.10.0/', 'lan']) {
      expect(cidr().safeParse(text).success, text).toBe(false);
    }
  });

  it('given host bits set, refuses with a message suggesting the network address', () => {
    expect(issueMessages(cidr().safeParse('10.0.10.5/24')).join()).toContain('10.0.10.0/24');
    expect(issueMessages(cidr().safeParse('2001:db8::1/48')).join()).toContain('2001:db8::/48');
  });

  it('tells whether an address is inside a network, across both families', () => {
    expect(cidrContains('10.0.10.0/24', '10.0.10.20')).toBe(true);
    expect(cidrContains('10.0.10.0/24', '10.0.11.1')).toBe(false);
    expect(cidrContains('0.0.0.0/0', '203.0.113.10')).toBe(true);
    expect(cidrContains('10.0.10.20/32', '10.0.10.20')).toBe(true);
    expect(cidrContains('2001:db8::/48', '2001:db8:0:ffff::1')).toBe(true);
    expect(cidrContains('2001:db8::/48', '2001:db9::1')).toBe(false);
    expect(cidrContains('10.0.10.0/24', '2001:db8::1')).toBe(false);
    expect(cidrContains('2001:db8::/32', '10.0.10.1')).toBe(false);
  });
});

describe('DNS names', () => {
  it('lowercases the name and removes a trailing dot', () => {
    expect(dnsName().parse('HomeLab.Example.')).toBe('homelab.example');
    expect(dnsName().parse('localhost')).toBe('localhost');
  });

  it('refuses empty labels, labels over 63 characters, a leading or trailing hyphen, and names over 253 characters', () => {
    const label63 = 'a'.repeat(63);
    expect(dnsName().safeParse(`${label63}.example`).success).toBe(true);
    for (const text of [
      '', '.', 'a..example', '-a.example', 'a-.example', 'under_score.example', 'with space.example',
      `${'a'.repeat(64)}.example`, [label63, label63, label63, label63].join('.'),
    ]) {
      expect(dnsName().safeParse(text).success, text).toBe(false);
    }
    expect(dnsName({ minLabels: 2 }).safeParse('localhost').success).toBe(false);
  });

  it('accepts punycode labels and refuses Unicode names', () => {
    expect(dnsName().parse('xn--caf-dma.example')).toBe('xn--caf-dma.example');
    expect(dnsName().safeParse('café.example').success).toBe(false);
  });
});
