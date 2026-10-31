import { describe, expect, it } from 'vitest';

import { SESSION_COOKIE } from '../../shared/contracts/security';
import { useTestAccounts } from '../../tests/support/accounts';
import { DIALECTS } from '../../tests/support/databases';

import type { Dialect } from '../../tests/support/databases';

describe.each(DIALECTS)('DELETE /api/session on %s', (dialect: Dialect) => {
  const accounts = useTestAccounts(dialect);

  it('given a session, deletes it server-side and clears the cookie: the old cookie no longer works (13)', async () => {
    const cookie = await accounts.signedIn();

    const { status, json, setCookie } = await accounts.call('DELETE', '/api/session', { cookie });

    expect(status).toBe(200);
    expect(json).toBeNull();
    expect(setCookie).toMatch(new RegExp(`^${SESSION_COOKIE.replaceAll('.', '\\.')}=;.*Max-Age=0`, 'i'));
    expect((await accounts.call('GET', '/api/session', { cookie })).json).toBeNull();
  });

  it('given no session, answers 401 unauthenticated', async () => {
    const { status, json } = await accounts.call('DELETE', '/api/session');

    expect(status).toBe(401);
    expect(json).toMatchObject({ code: 'unauthenticated' });
  });
});
