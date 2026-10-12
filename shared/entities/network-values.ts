import { z } from 'zod';

const unimplemented = () => z.never() as unknown as z.ZodType<string, string>;

/** The address in canonical form (IPv6 per RFC 5952), or undefined when it is not an IP address. */
export function normalizeIp(_text: string): string | undefined {
  throw new Error('Not implemented');
}

/** Whether the address is inside the network; never across address families. */
export function cidrContains(_cidr: string, _address: string): boolean {
  throw new Error('Not implemented');
}

export const ipAddress = unimplemented;
export const ipv4Address = unimplemented;
export const ipv6Address = unimplemented;
export const cidr = unimplemented;
export const dnsName = (_options: { minLabels?: number } = {}) => unimplemented();
