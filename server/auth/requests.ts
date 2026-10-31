import { appendResponseHeader, getRequestIP, getRequestURL, setResponseHeader } from 'h3';

import { problemOf } from '../../shared/contracts/errors';
import { hitRateLimit } from '../repositories/accounts';

import type { Database } from '../database/types/schema';
import type { H3Event } from 'h3';
import type { Kysely } from 'kysely';

/** Attempts per address and window on setup and sign-in. */
const LIMIT = { windowMs: 60_000, max: 5 };

/**
 * The caller's address. `X-Forwarded-For` only with `TRUST_PROXY=true`: anyone can send it, so trusting it without a
 * proxy that sets it would let a caller pick a new address for every attempt.
 */
export const clientAddress = (event: H3Event): string =>
  getRequestIP(event, { xForwardedFor: process.env.TRUST_PROXY?.trim().toLowerCase() === 'true' }) ?? 'unknown';

/** Counts an attempt for this action and address; the 429 answer, with Retry-After, when over the limit. */
export async function throttle(db: Kysely<Database>, event: H3Event, action: 'setup' | 'sign-in') {
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
