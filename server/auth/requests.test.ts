import { createApp, createRouter, defineEventHandler, toWebHandler } from 'h3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clientAddress } from './requests';

/** The address a request is counted under, as the account routes see it. */
const addressOf = async (forwardedFor?: string) => {
  const app = createApp().use(createRouter().get('/', defineEventHandler((event) => clientAddress(event))));
  const response = await toWebHandler(app)(new Request('http://localhost/', {
    headers: forwardedFor === undefined ? {} : { 'x-forwarded-for': forwardedFor },
  }));
  return response.text();
};

describe('clientAddress', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('without TRUST_PROXY, ignores X-Forwarded-For: anyone can send it', async () => {
    vi.stubEnv('TRUST_PROXY', '');

    expect(await addressOf('203.0.113.5')).toBe('unknown');
  });

  it('with TRUST_PROXY, takes the address the proxy added, the last one, not one the client put first', async () => {
    vi.stubEnv('TRUST_PROXY', 'true');

    expect(await addressOf('198.51.100.7, 203.0.113.5')).toBe('203.0.113.5');
    expect(await addressOf('203.0.113.5')).toBe('203.0.113.5');
  });

  it('given a last entry that is not an IP address, uses none of the header', async () => {
    vi.stubEnv('TRUST_PROXY', 'true');

    expect(await addressOf('203.0.113.5, not-an-address')).toBe('unknown');
    expect(await addressOf(`203.0.113.5, ${'9'.repeat(4000)}`)).toBe('unknown');
  });

  it('counts IPv6 clients by their /64 network: one host has all of it', async () => {
    vi.stubEnv('TRUST_PROXY', 'true');

    const first = await addressOf('2001:db8:1:2::1');
    expect(await addressOf('2001:db8:1:2:ffff::9')).toBe(first);
    expect(await addressOf('2001:db8:1:3::1')).not.toBe(first);
  });
});
