import { createApp, createRouter, toWebHandler } from 'h3';

import type { EventHandler } from 'h3';

type Method = 'get' | 'post' | 'patch' | 'delete';

/** A documentation address (RFC 5737): attempts are limited per address. */
export const TEST_IP = '192.0.2.30';

/**
 * Serves one route as the app does and answers a fetch-like function: status, parsed JSON (undefined when empty) and
 * headers. Requests carry an address, as behind the trusted proxy the integration tests configure.
 */
export function serveRoute(method: Method, pattern: string, handler: EventHandler) {
  const fetch = toWebHandler(createApp().use(createRouter()[method](pattern, handler)));
  return async (path: string, { body, ip = TEST_IP }: { body?: unknown; ip?: string } = {}) => {
    const response = await fetch(new Request(`http://localhost${path}`, {
      method: method.toUpperCase(),
      headers: { 'x-forwarded-for': ip, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }));
    const text = await response.text();
    const json = (text ? JSON.parse(text) : undefined) as unknown;
    return { status: response.status, json, headers: response.headers };
  };
}
