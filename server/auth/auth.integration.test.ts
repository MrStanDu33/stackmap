import { sql } from 'kysely';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SESSION_COOKIE } from '../../shared/contracts/security';
import { ADMIN, useTestAccounts } from '../../tests/support/accounts';
import { DIALECTS } from '../../tests/support/databases';
import { resetAuth } from '../utils/auth';

import type { Dialect } from '../../tests/support/databases';

describe.each(DIALECTS)('accounts on %s', (dialect: Dialect) => {
  const accounts = useTestAccounts(dialect);

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAuth();
  });

  it('uses the session cookie the API document declares, HTTP-only and SameSite=Lax, not Secure over HTTP', async () => {
    const { setCookie } = await accounts.setUp();

    expect(setCookie?.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
    expect(setCookie).toMatch(/;\s*HttpOnly/i);
    expect(setCookie).toMatch(/;\s*SameSite=Lax/i);
    expect(setCookie).not.toMatch(/;\s*Secure/i);
  });

  it('marks the cookie Secure, with its __Secure- prefix, when BETTER_AUTH_URL is HTTPS', async () => {
    vi.stubEnv('BETTER_AUTH_URL', 'https://stackmap.homelab.example');
    resetAuth();

    const { setCookie } = await accounts.setUp();

    expect(setCookie?.startsWith(`__Secure-${SESSION_COOKIE}=`)).toBe(true);
    expect(setCookie).toMatch(/;\s*Secure/i);
  });

  it('stores emails lower-cased and finds them whatever their case', async () => {
    await accounts.setUp({ email: 'Ada@Homelab.Example' });

    const { rows } = await sql<{ email: string }>`select email from ${sql.table('user')}`.execute(accounts.db());
    expect(rows.map(({ email }) => email)).toEqual([ADMIN.email]);
    expect((await accounts.call('POST', '/api/session', {
      body: { email: 'ADA@HOMELAB.EXAMPLE', password: ADMIN.password },
    })).status).toBe(200);
  });

  it('hashes passwords: the stored value is not the password', async () => {
    await accounts.setUp();

    const { rows } = await sql<{ password: string }>`select password from ${sql.table('account')}`.execute(accounts.db());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.password).not.toContain(ADMIN.password);
  });
});
