import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { SESSION_COOKIE } from '../../shared/contracts/security';
import { ADMIN, useTestAccounts } from '../../tests/support/accounts';
import { DIALECTS } from '../../tests/support/databases';

import type { Dialect } from '../../tests/support/databases';

describe.each(DIALECTS)('POST /api/session on %s', (dialect: Dialect) => {
  const accounts = useTestAccounts(dialect);

  it('given the right email in any case and password, answers 200 with the session and sets the cookie', async () => {
    await accounts.signedIn();

    const { status, json, setCookie } = await accounts.call('POST', '/api/session', {
      body: { email: 'ADA@Homelab.Example', password: ADMIN.password },
    });

    expect(status).toBe(200);
    expect(json).toMatchObject({ user: { email: ADMIN.email, role: 'admin' } });
    expect(setCookie).toMatch(new RegExp(`^${SESSION_COOKIE.replaceAll('.', '\\.')}=`));
  });

  it('given a wrong email or a wrong password, answers the same 401 invalid_credentials (10)', async () => {
    await accounts.signedIn();

    const wrongEmail = await accounts.call('POST', '/api/session', {
      body: { email: 'grace@homelab.example', password: ADMIN.password },
    });
    const wrongPassword = await accounts.call('POST', '/api/session', {
      body: { email: ADMIN.email, password: 'not the password' },
    });

    expect(wrongEmail.status).toBe(401);
    expect(wrongEmail.json).toMatchObject({ code: 'invalid_credentials' });
    // The same answer: nothing tells whether the email exists.
    expect(wrongPassword.json).toEqual(wrongEmail.json);
    expect(wrongEmail.setCookie).toBeNull();
  });

  it('given 5 failed attempts from one address within a minute, answers the 6th 429 too_many_requests with Retry-After (11)', async () => {
    await accounts.signedIn();
    const attempt = () => accounts.call('POST', '/api/session', {
      body: { email: ADMIN.email, password: 'not the password' },
      ip: '192.0.2.40',
    });

    for (let count = 0; count < 5; count += 1) {
      expect((await attempt()).status).toBe(401);
    }
    const sixth = await attempt();

    expect(sixth.status).toBe(429);
    expect(sixth.json).toMatchObject({ code: 'too_many_requests' });
    expect(Number(sixth.headers.get('retry-after'))).toBeGreaterThan(0);
    // Another address is not held back.
    expect((await accounts.call('POST', '/api/session', {
      body: { email: ADMIN.email, password: ADMIN.password }, ip: '192.0.2.41',
    })).status).toBe(200);
  });

  it('given an account Better Auth refuses for another reason (banned), answers the same 401 as a wrong password', async () => {
    await accounts.signedIn();
    await sql`update ${sql.table('user')} set banned = ${dialect === 'postgres' ? sql`true` : sql`1`}`.execute(accounts.db());

    const banned = await accounts.call('POST', '/api/session', { body: { email: ADMIN.email, password: ADMIN.password } });
    const wrong = await accounts.call('POST', '/api/session', { body: { email: ADMIN.email, password: 'not the password' } });

    expect(banned.status).toBe(401);
    expect(banned.json).toEqual(wrong.json);
  });

  it('records the session\'s address as the limiter counts it, the one the proxy added', async () => {
    await accounts.signedIn();

    await accounts.call('POST', '/api/session', {
      body: { email: ADMIN.email, password: ADMIN.password }, ip: '198.51.100.7, 192.0.2.42',
    });

    const { rows } = await sql<{ ipAddress: string }>`select ${sql.ref('ipAddress')} from ${sql.table('session')}`
      .execute(accounts.db());
    expect(rows.map(({ ipAddress }) => ipAddress)).toContain('192.0.2.42');
    expect(rows.map(({ ipAddress }) => ipAddress)).not.toContain('198.51.100.7');
  });
});
