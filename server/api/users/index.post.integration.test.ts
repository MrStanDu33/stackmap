import { describe, expect, it } from 'vitest';

import { createAccount, useTestAccounts } from '../../../tests/support/accounts';
import { DIALECTS } from '../../../tests/support/databases';

import type { Dialect } from '../../../tests/support/databases';

const GRACE = { name: 'Grace', email: 'Grace@HomeLab.example', password: 'temporary horse battery' };

describe.each(DIALECTS)('POST /api/users on %s', (dialect: Dialect) => {
  const accounts = useTestAccounts(dialect);

  it('given the administrator, creates a plain user with no workspace, its email in lower case (2)', async () => {
    const cookie = await accounts.signedIn();

    const { status, json } = await accounts.call('POST', '/api/users', { cookie, body: GRACE });

    expect(status).toBe(201);
    expect(json).toEqual({
      id: expect.any(String) as unknown, name: 'Grace', email: 'grace@homelab.example', role: 'user', createdAt: expect.any(String) as unknown,
    });
    const memberships = await accounts.db().selectFrom('member').select('workspaceId')
      .where('userId', '=', (json as { id: string }).id).execute();
    expect(memberships).toEqual([]);
  });

  it('sets no cookie and leaves the administrator signed in as themselves (2)', async () => {
    const cookie = await accounts.signedIn();

    const { status, setCookie } = await accounts.call('POST', '/api/users', { cookie, body: GRACE });

    expect(status).toBe(201);
    expect(setCookie).toBeNull();
    expect((await accounts.call('GET', '/api/session', { cookie })).json).toMatchObject({ user: { role: 'admin' } });
  });

  it('the new account then signs in with that email and password (2)', async () => {
    const cookie = await accounts.signedIn();
    await accounts.call('POST', '/api/users', { cookie, body: GRACE });

    await expect(accounts.signInAs('grace@homelab.example', GRACE.password)).resolves.toBeTruthy();
  });

  it('given an email that already has an account in any case, answers 409 email_taken and changes nothing (3)', async () => {
    const cookie = await accounts.signedIn();
    await createAccount(accounts.db(), { name: 'Grace', email: 'grace@homelab.example' });

    const { status, json } = await accounts.call('POST', '/api/users', { cookie, body: { ...GRACE, name: 'Someone else' } });

    expect(status).toBe(409);
    expect(json).toMatchObject({ type: 'urn:stackmap:problem:email_taken' });
    expect(await accounts.db().selectFrom('user').select('name').where('email', '=', 'grace@homelab.example').execute())
      .toEqual([{ name: 'Grace' }]);
  });

  it.each([
    ['an invalid email', { email: 'grace' }, 'body.email'],
    ['a name over the limit', { name: 'G'.repeat(101) }, 'body.name'],
    ['a password under 12 characters', { password: 'short' }, 'body.password'],
    ['a password over 128 characters', { password: 'p'.repeat(129) }, 'body.password'],
  ])('given %s, answers 400 with the field\'s issue (4)', async (_case, change, path) => {
    const cookie = await accounts.signedIn();

    const { status, json } = await accounts.call('POST', '/api/users', { cookie, body: { ...GRACE, ...change } });

    expect(status).toBe(400);
    expect((json as { issues: { path: string }[] }).issues.map((issue) => issue.path)).toEqual([path]);
    expect(await accounts.count('user')).toBe(1);
  });

  it('given a plain user, answers 403 before the body is parsed (5)', async () => {
    await accounts.signedIn();
    await createAccount(accounts.db(), { name: 'Alan', email: 'alan@homelab.example' });
    const cookie = await accounts.signInAs('alan@homelab.example');

    const { status } = await accounts.call('POST', '/api/users', { cookie, body: { not: 'valid' } });

    expect(status).toBe(403);
  });
});
