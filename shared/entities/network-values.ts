import { z } from 'zod';

/*
 * IP addresses, networks and DNS names, normalized so that equal values are stored the same way: IPv6 in the RFC 5952
 * form, DNS names in lowercase without a trailing dot. Pure functions, shared by forms and the server.
 */

const IPV4_OCTET = String.raw`(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)`;
const IPV4 = new RegExp(`^${IPV4_OCTET}(?:\\.${IPV4_OCTET}){3}$`);
const IPV6_GROUP = /^[0-9a-f]{1,4}$/i;
const DNS_LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const MAX_DNS_NAME = 253;

interface Ip {
  version: 4 | 6;
  value: bigint;
}

const BITS = { 4: 32, 6: 128 } as const;

function parseIpv4(text: string): number[] | undefined {
  return IPV4.test(text) ? text.split('.').map(Number) : undefined;
}

/** The 8 groups of an IPv6 address, or undefined. Accepts `::` and an IPv4 tail (`::ffff:10.0.10.20`). */
function parseIpv6(text: string): number[] | undefined {
  let body = text;
  let tail: number[] = [];
  if (text.includes('.')) {
    const lastColon = text.lastIndexOf(':');
    const ipv4 = parseIpv4(text.slice(lastColon + 1));
    if (!ipv4) {
      return undefined;
    }
    const [a = 0, b = 0, c = 0, d = 0] = ipv4;
    tail = [(a << 8) | b, (c << 8) | d];
    body = text.slice(0, lastColon + 1);
    body = body.endsWith('::') ? body : body.slice(0, -1);
  }
  const halves = body.split('::');
  if (halves.length > 2) {
    return undefined;
  }
  const groupsOf = (part: string) => (part === '' ? [] : part.split(':'));
  const head = groupsOf(halves[0] ?? '');
  const rest = groupsOf(halves[1] ?? '');
  if (![...head, ...rest].every((group) => IPV6_GROUP.test(group))) {
    return undefined;
  }
  const given = head.length + rest.length + tail.length;
  // `::` stands for at least one group of zeros.
  if (halves.length === 1 ? given !== 8 : given > 7) {
    return undefined;
  }
  const zeros = Array.from({ length: 8 - given }, () => 0);
  return [...head.map((group) => parseInt(group, 16)), ...zeros, ...rest.map((group) => parseInt(group, 16)), ...tail];
}

function parseIp(text: string): Ip | undefined {
  const ipv4 = parseIpv4(text);
  if (ipv4) {
    return { version: 4, value: ipv4.reduce((value, octet) => (value << 8n) | BigInt(octet), 0n) };
  }
  const ipv6 = parseIpv6(text);
  if (ipv6) {
    return { version: 6, value: ipv6.reduce((value, group) => (value << 16n) | BigInt(group), 0n) };
  }
  return undefined;
}

/** RFC 5952: lowercase, no leading zeros, the longest run of two or more zero groups (the first on a tie) as `::`. */
function formatIpv6(value: bigint): string {
  const groups = Array.from({ length: 8 }, (_, index) => Number((value >> BigInt(112 - (index * 16))) & 0xffffn));
  // IPv4-mapped addresses keep their IPv4 part dotted.
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return `::ffff:${formatIpv4(value & 0xffffffffn)}`;
  }
  let best = { start: -1, length: 1 };
  for (let start = 0; start < 8; start += 1) {
    let length = 0;
    while (start + length < 8 && groups[start + length] === 0) {
      length += 1;
    }
    if (length > best.length) {
      best = { start, length };
    }
  }
  const hex = groups.map((group) => group.toString(16));
  if (best.start === -1) {
    return hex.join(':');
  }
  return `${hex.slice(0, best.start).join(':')}::${hex.slice(best.start + best.length).join(':')}`;
}

function formatIpv4(value: bigint): string {
  return [24n, 16n, 8n, 0n].map((shift) => String((value >> shift) & 0xffn)).join('.');
}

const formatIp = ({ version, value }: Ip): string => (version === 4 ? formatIpv4(value) : formatIpv6(value));

/** The address in canonical form (IPv6 per RFC 5952), or undefined when it is not an IP address. */
export function normalizeIp(text: string): string | undefined {
  const ip = parseIp(text);
  return ip && formatIp(ip);
}

interface Cidr extends Ip {
  prefix: number;
}

type CidrCheck = { cidr: Cidr } | { error: string };

function checkCidr(text: string): CidrCheck {
  const [address = '', prefixText, ...extra] = text.split('/');
  const ip = parseIp(address);
  if (!ip || prefixText === undefined || extra.length > 0 || !/^(?:0|[1-9]\d{0,2})$/.test(prefixText)) {
    return { error: 'Expected a network in CIDR notation, such as 10.0.10.0/24 or 2001:db8::/48' };
  }
  const prefix = Number(prefixText);
  const bits = BITS[ip.version];
  if (prefix > bits) {
    return { error: `The prefix of an IPv${String(ip.version)} network is at most /${String(bits)}` };
  }
  const hostBits = (1n << BigInt(bits - prefix)) - 1n;
  if ((ip.value & hostBits) !== 0n) {
    const network = formatIp({ version: ip.version, value: ip.value & ~hostBits });
    return { error: `Host bits are set: did you mean ${network}/${String(prefix)}?` };
  }
  return { cidr: { ...ip, prefix } };
}

/** Whether the address is inside the network; never across address families. */
export function cidrContains(cidr: string, address: string): boolean {
  const network = checkCidr(cidr);
  const ip = parseIp(address);
  if ('error' in network || !ip || ip.version !== network.cidr.version) {
    return false;
  }
  const shift = BigInt(BITS[ip.version] - network.cidr.prefix);
  return ip.value >> shift === network.cidr.value >> shift;
}

/** Lowercase without a trailing dot, or undefined when it is not a DNS name with at least `minLabels` labels. */
export function normalizeDnsName(text: string, minLabels = 1): string | undefined {
  const name = text.toLowerCase().replace(/\.$/, '');
  const labels = name.split('.');
  if (name.length === 0 || name.length > MAX_DNS_NAME || labels.length < minLabels) {
    return undefined;
  }
  return labels.every((label) => DNS_LABEL.test(label)) ? name : undefined;
}

/** A string schema that stores the normalized value, or fails with the message. */
const normalized = (maxLength: number, normalize: (text: string) => string | undefined, message: () => string) =>
  z.string().max(maxLength).transform((text, context) => {
    const value = normalize(text);
    if (value === undefined) {
      context.addIssue({ code: 'custom', message: message() });
      return z.NEVER;
    }
    return value;
  });

/** Long enough for any IPv6 form, `ffff:ffff:ffff:ffff:ffff:ffff:255.255.255.255` included. */
const MAX_IP = 45;

const ofVersion = (version: 4 | 6) => (text: string) => {
  const ip = parseIp(text);
  return ip?.version === version ? formatIp(ip) : undefined;
};

export const ipAddress = () => normalized(MAX_IP, normalizeIp, () => 'Expected an IPv4 or IPv6 address');
export const ipv4Address = () => normalized(MAX_IP, ofVersion(4), () => 'Expected an IPv4 address');
export const ipv6Address = () => normalized(MAX_IP, ofVersion(6), () => 'Expected an IPv6 address');

export const cidr = () => z.string().max(MAX_IP + 4).transform((text, context) => {
  const checked = checkCidr(text);
  if ('error' in checked) {
    context.addIssue({ code: 'custom', message: checked.error });
    return z.NEVER;
  }
  return `${formatIp(checked.cidr)}/${String(checked.cidr.prefix)}`;
});

export const dnsName = ({ minLabels = 1 }: { minLabels?: number } = {}) => normalized(
  MAX_DNS_NAME + 1,
  (text) => normalizeDnsName(text, minLabels),
  () => (minLabels > 1 ? `Expected a DNS name of at least ${String(minLabels)} labels` : 'Expected a DNS name'),
);
