import { afterEach, describe, expect, it, vi } from 'vitest';

import { SESSION_COOKIE } from '../../shared/contracts/security';
import { ADMIN, useTestAccounts } from '../../tests/support/accounts';
import { DIALECTS } from '../../tests/support/databases';

import type { Dialect } from '../../tests/support/databases';

describe.each(DIALECTS)('GET /api/session on %s', (dialect: Dialect) => {
  const accounts = useTestAccounts(dialect);

  afterEach(() => {
    vi.useRealTimers();
  });

  it('given a session, answers the user\'s id, name, email and instance role (12)', async () => {
    const cookie = await accounts.signedIn();

    const { status, json } = await accounts.call('GET', '/api/session', { cookie });

    expect(status).toBe(200);
    expect(json).toEqual({ user: { id: expect.any(String) as unknown, name: ADMIN.name, email: ADMIN.email, role: 'admin' } });
  });

  it('given no session, or an expired or forged cookie, answers null (12, 17)', async () => {
    const cookie = await accounts.signedIn();
    const forged = `${SESSION_COOKIE}=${'a'.repeat(32)}.${'b'.repeat(43)}`;

    expect((await accounts.call('GET', '/api/session')).json).toBeNull();
    expect((await accounts.call('GET', '/api/session', { cookie: forged })).json).toBeNull();
    vi.useFakeTimers({ now: Date.now() + 8 * 24 * 60 * 60_000, toFake: ['Date'] });
    expect((await accounts.call('GET', '/api/session', { cookie })).json).toBeNull();
  });
});
