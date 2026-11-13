import { describe, expect, it } from 'vitest';

import { createAccount, useTestAccounts } from '../../../tests/support/accounts';
import { DIALECTS } from '../../../tests/support/databases';

import type { Dialect } from '../../../tests/support/databases';

describe.each(DIALECTS)('PATCH /api/users/:userId on %s', (dialect: Dialect) => {
  const accounts = useTestAccounts(dialect);
  const grace = () => createAccount(accounts.db(), { name: 'Grace', email: 'grace@homelab.example' });
  const myId = async (cookie: string) =>
    ((await accounts.call('GET', '/api/session', { cookie })).json as { user: { id: string } }).user.id;

  it('given the administrator promoting a plain user, gives them instanceAdmin access on their next request (8)', async () => {
    const cookie = await accounts.signedIn();
    const { user } = await grace();
    const graceCookie = await accounts.signInAs('grace@homelab.example');
    expect((await accounts.call('GET', '/api/users', { cookie: graceCookie })).status).toBe(403);

    const { status, json } = await accounts.call('PATCH', `/api/users/${user.id}`, { cookie, body: { role: 'admin' } });

    expect(status).toBe(200);
    expect(json).toMatchObject({ id: user.id, role: 'admin' });
    expect((await accounts.call('GET', '/api/users', { cookie: graceCookie })).status).toBe(200);
  });

  it('given an administrator demoted to user, answers them 403 on their next request (8)', async () => {
    const cookie = await accounts.signedIn();
    const { user } = await grace();
    await accounts.call('PATCH', `/api/users/${user.id}`, { cookie, body: { role: 'admin' } });
    const graceCookie = await accounts.signInAs('grace@homelab.example');
    expect((await accounts.call('GET', '/api/users', { cookie: graceCookie })).status).toBe(200);

    await accounts.call('PATCH', `/api/users/${user.id}`, { cookie, body: { role: 'user' } });

    expect((await accounts.call('GET', '/api/users', { cookie: graceCookie })).status).toBe(403);
  });

  it('given the administrator demoting themselves, answers 409 cannot_demote_self (9)', async () => {
    const cookie = await accounts.signedIn();
    const { user } = await grace();
    await accounts.call('PATCH', `/api/users/${user.id}`, { cookie, body: { role: 'admin' } });

    const { status, json } = await accounts.call('PATCH', `/api/users/${await myId(cookie)}`, { cookie, body: { role: 'user' } });

    expect(status).toBe(409);
    expect(json).toMatchObject({ type: 'urn:stackmap:problem:cannot_demote_self' });
  });

  it('given two administrators demoting each other at once, one succeeds and the other gets 409 last_admin (10)', async () => {
    const cookie = await accounts.signedIn();
    const { user } = await grace();
    await accounts.call('PATCH', `/api/users/${user.id}`, { cookie, body: { role: 'admin' } });
    const graceCookie = await accounts.signInAs('grace@homelab.example');

    const answers = await Promise.all([
      accounts.call('PATCH', `/api/users/${user.id}`, { cookie, body: { role: 'user' } }),
      accounts.call('PATCH', `/api/users/${await myId(cookie)}`, { cookie: graceCookie, body: { role: 'user' } }),
    ]);

    // The loser may also be refused 403, if the winner's demotion is read first: either way one admin stays.
    expect(answers.map(({ status }) => status).toSorted()).toEqual([200, expect.any(Number) as unknown]);
    expect(answers.filter(({ status }) => status === 200)).toHaveLength(1);
    expect(await accounts.db().selectFrom('user').select('id').where('role', '=', 'admin').execute()).toHaveLength(1);
  });

  it('given an unknown id, answers 404 user_not_found (11)', async () => {
    const cookie = await accounts.signedIn();

    const { status, json } = await accounts.call('PATCH', '/api/users/0199d6a0-0000-7000-8000-000000000999', { cookie, body: { role: 'admin' } });

    expect(status).toBe(404);
    expect(json).toMatchObject({ type: 'urn:stackmap:problem:user_not_found' });
  });

  it('given a plain user, answers 403', async () => {
    await accounts.signedIn();
    const { user } = await grace();
    const cookie = await accounts.signInAs('grace@homelab.example');

    expect((await accounts.call('PATCH', `/api/users/${user.id}`, { cookie, body: { role: 'admin' } })).status).toBe(403);
  });
});
