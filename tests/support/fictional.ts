import { cidrContains, normalizeIp } from '@stackmap/extension-sdk/entities';

/** Ranges no real host is reachable at: documentation, private, unique local, unspecified and loopback. */
const FICTIONAL_NETWORKS = [
  '192.0.2.0/24', '198.51.100.0/24', '203.0.113.0/24', // RFC 5737
  '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', // RFC 1918
  '0.0.0.0/32', '127.0.0.0/8',
  '2001:db8::/32', // RFC 3849
  'fd00::/8', '::/128', '::1/128',
];

/** Reserved for tests and documentation: RFC 2606 and RFC 6761. */
const FICTIONAL_DOMAINS = ['example', 'test', 'invalid', 'example.com', 'example.net', 'example.org'];

/** Whether an address or a CIDR is in a range that no real infrastructure uses. */
export function isFictionalIp(text: string): boolean {
  const [address = '', prefix] = text.split('/');
  const normalized = normalizeIp(address);
  if (normalized === undefined) {
    return false;
  }
  return FICTIONAL_NETWORKS.some((network) => cidrContains(network, normalized)
    && (prefix === undefined || Number(prefix) >= Number(network.split('/')[1])));
}

/** Whether a DNS name is reserved for examples. */
export function isFictionalDnsName(name: string): boolean {
  const lowercase = name.toLowerCase().replace(/\.$/, '');
  return FICTIONAL_DOMAINS.some((domain) => lowercase === domain || lowercase.endsWith(`.${domain}`));
}
