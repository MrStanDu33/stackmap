import { isIP } from 'node:net';

import { appendResponseHeader, getRequestIP, getRequestURL, setResponseHeader } from 'h3';

import { problemOf } from '../../shared/contracts/errors';
import { hitRateLimit } from '../repositories/accounts';

import type { Database } from '../database/types/schema';
import type { H3Event } from 'h3';
import type { Kysely } from 'kysely';

/** Attempts per address and window on setup and sign-in. */
const LIMIT = { windowMs: 60_000, max: 5 };

const trustProxy = () => process.env.TRUST_PROXY?.trim().toLowerCase() === 'true';

/**
 * The client's IP address: the socket's, or with `TRUST_PROXY=true` the last `X-Forwarded-For` entry, the one the
 * proxy added (a client can put anything before it). Undefined when it is not an IP address.
 */
export function clientIp(headers: Headers, socketAddress?: string): string | undefined {
  const forwarded = trustProxy() ? headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() : undefined;
  const address = forwarded ?? socketAddress;
  return address && isIP(address) ? address.replace(/^::ffff:(?=\d+\.)/, '') : undefined;
}

/** `2001:db8:1:2::/64` for any address of that network: one host usually has a whole /64. */
function network64(address: string): string {
  const [head = '', tail = ''] = address.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = address.includes('::')
    ? [...left, ...Array<string>(8 - left.length - right.length).fill('0'), ...right]
    : left;
  return `${groups.slice(0, 4).map((group) => Number.parseInt(group, 16).toString(16)).join(':')}::/64`;
}

/** What attempts are counted under: the client's IPv4 address or IPv6 /64, or `unknown`. */
export function clientAddress(event: H3Event): string {
  const ip = clientIp(event.headers, getRequestIP(event));
  if (!ip) {
    return 'unknown';
  }
  return isIP(ip) === 6 ? network64(ip) : ip;
}

/** Counts an attempt for this action and address; the 429 answer, with Retry-After, when over the limit. */
export async function throttle(db: Kysely<Database>, event: H3Event, action: 'setup' | 'sign-in' | 'invitation') {
  const { allowed, retryAfter } = await hitRateLimit(db, `${action}:${clientAddress(event)}`, { ...LIMIT, now: Date.now() });
  if (allowed) {
    return null;
  }
  setResponseHeader(event, 'retry-after', retryAfter);
  return {
    status: 429 as const,
    body: problemOf('too_many_requests', {
      detail: `Too many attempts. Try again in ${String(retryAfter)} seconds.`,
      instance: getRequestURL(event).pathname,
    }),
  };
}

/** Copies the cookies Better Auth set onto the response. */
export function forwardCookies(event: H3Event, headers: Headers): void {
  for (const cookie of headers.getSetCookie()) {
    appendResponseHeader(event, 'set-cookie', cookie);
  }
}
