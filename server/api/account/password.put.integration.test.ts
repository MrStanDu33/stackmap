import { sql } from 'kysely';
import { describe, expect, it, vi } from 'vitest';

import { ADMIN, cookieOf, useTestAccounts } from '../../../tests/support/accounts';
import { DIALECTS } from '../../../tests/support/databases';
import { useAuth } from '../../utils/auth';

import type { Dialect } from '../../../tests/support/databases';

const NEW_PASSWORD = 'brand new horse battery';

describe.each(DIALECTS)('PUT /api/account/password on %s', (dialect: Dialect) => {
  const accounts = useTestAccounts(dialect);
  const change = (cookie: string, body: unknown, ip?: string) => accounts.call('PUT', '/api/account/password', { cookie, body, ip });

  it('given the current password, answers 204: the new one works and the old one fails (7)', async () => {
    const cookie = await accounts.signedIn();

    const { status } = await change(cookie, { currentPassword: ADMIN.password, newPassword: NEW_PASSWORD });

    expect(status).toBe(204);
    await expect(accounts.signInAs(ADMIN.email, NEW_PASSWORD)).resolves.toBeTruthy();
    await expect(accounts.signInAs(ADMIN.email)).rejects.toThrow('401');
  });

  it('signs out the other sessions and keeps this one (7)', async () => {
    const cookie = await accounts.signedIn();
    const other = await accounts.signInAs(ADMIN.email);

    const { setCookie } = await change(cookie, { currentPassword: ADMIN.password, newPassword: NEW_PASSWORD });

    // Better Auth may issue this session a new token: the cookie the answer sets, or the same one.
    const current = cookieOf(setCookie) ?? cookie;
    expect((await accounts.call('GET', '/api/session', { cookie: current })).json).not.toBeNull();
    expect((await accounts.call('GET', '/api/session', { cookie: other })).json).toBeNull();
  });

  it('given a wrong current password, answers 400 wrong_password and changes nothing (8)', async () => {
    const cookie = await accounts.signedIn();

    const { status, json } = await change(cookie, { currentPassword: 'not the password', newPassword: NEW_PASSWORD });

    expect(status).toBe(400);
    expect(json).toMatchObject({ type: 'urn:stackmap:problem:wrong_password' });
    await expect(accounts.signInAs(ADMIN.email)).resolves.toBeTruthy();
  });

  it('limits attempts per address, 5 a minute, with 429 and Retry-After (8)', async () => {
    const cookie = await accounts.signedIn();
    const wrong = { currentPassword: 'not the password', newPassword: NEW_PASSWORD };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await change(cookie, wrong, '192.0.2.77')).status).toBe(400);
    }
    const throttled = await change(cookie, wrong, '192.0.2.77');

    expect(throttled.status).toBe(429);
    expect(Number(throttled.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it.each([
    ['equal to the current one', ADMIN.password],
    ['under 12 characters', 'short'],
    ['over 128 characters', 'p'.repeat(129)],
  ])('given a new password %s, answers 400 on that field (9)', async (_case, newPassword) => {
    const cookie = await accounts.signedIn();

    const { status, json } = await change(cookie, { currentPassword: ADMIN.password, newPassword });

    expect(status).toBe(400);
    expect((json as { issues: { path: string }[] }).issues.map((issue) => issue.path)).toEqual(['body.newPassword']);
  });

  it('given a marked account, clears the mark (13)', async () => {
    const cookie = await accounts.signedIn();
    await accounts.call('POST', '/api/users', { cookie, body: { name: 'Grace', email: 'grace@homelab.example', password: 'temporary horse battery' } });
    const grace = await accounts.signInAs('grace@homelab.example', 'temporary horse battery');

    const { status, setCookie } = await change(grace, { currentPassword: 'temporary horse battery', newPassword: NEW_PASSWORD });

    expect(status).toBe(204);
    const { json } = await accounts.call('GET', '/api/session', { cookie: cookieOf(setCookie) ?? grace });
    expect(json).toMatchObject({ user: { mustChangePassword: false } });
  });

  it('limits attempts per account as well, whatever the addresses (8, review)', async () => {
    const cookie = await accounts.signedIn();
    const wrong = { currentPassword: 'not the password', newPassword: NEW_PASSWORD };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await change(cookie, wrong, `192.0.2.${String(80 + attempt)}`)).status).toBe(400);
    }

    expect((await change(cookie, wrong, '192.0.2.90')).status).toBe(429);
  });

  it('keeps a mark an administrator sets while an unmarked account changes its password (13, review)', async () => {
    const cookie = await accounts.signedIn();
    const { api } = await useAuth();
    const original = api.changePassword.bind(api);
    // An administrator gives the account a temporary password while its own change is under way.
    vi.spyOn(api, 'changePassword').mockImplementationOnce(async (...args) => {
      await accounts.db().updateTable('user').set({ mustChangePassword: sql.lit(true) }).where('email', '=', ADMIN.email).execute();
      return original(...args);
    });

    expect((await change(cookie, { currentPassword: ADMIN.password, newPassword: NEW_PASSWORD })).status).toBe(204);

    const row = await accounts.db().selectFrom('user').select('mustChangePassword').where('email', '=', ADMIN.email).executeTakeFirst();
    expect(Boolean(row?.mustChangePassword)).toBe(true);
    vi.restoreAllMocks();
  });
});
