import { describe, expect, it, vi } from 'vitest';

import { createAccount, useTestAccounts } from '../../../../tests/support/accounts';
import { DIALECTS } from '../../../../tests/support/databases';
import { useAuth } from '../../../utils/auth';

import type { Dialect } from '../../../../tests/support/databases';

const NEW_PASSWORD = 'brand new horse battery';

describe.each(DIALECTS)('PUT /api/users/:userId/password on %s', (dialect: Dialect) => {
  const accounts = useTestAccounts(dialect);
  const grace = () => createAccount(accounts.db(), { name: 'Grace', email: 'grace@homelab.example' });

  it('given the administrator, answers 204: the old password fails and the new one works (6)', async () => {
    const cookie = await accounts.signedIn();
    const { user } = await grace();

    const { status } = await accounts.call('PUT', `/api/users/${user.id}/password`, { cookie, body: { password: NEW_PASSWORD } });

    expect(status).toBe(204);
    await expect(accounts.signInAs('grace@homelab.example')).rejects.toThrow('401');
    await expect(accounts.signInAs('grace@homelab.example', NEW_PASSWORD)).resolves.toBeTruthy();
  });

  it('signs the account out everywhere (6)', async () => {
    const cookie = await accounts.signedIn();
    const { user } = await grace();
    const graceCookie = await accounts.signInAs('grace@homelab.example');

    await accounts.call('PUT', `/api/users/${user.id}/password`, { cookie, body: { password: NEW_PASSWORD } });

    expect((await accounts.call('GET', '/api/session', { cookie: graceCookie })).json).toBeNull();
    expect((await accounts.call('GET', '/api/session', { cookie })).json).not.toBeNull();
  });

  it('given setting the password fails, has already signed the account out (6, review)', async () => {
    const cookie = await accounts.signedIn();
    const { user } = await grace();
    const graceCookie = await accounts.signInAs('grace@homelab.example');
    // The only stand-in: a database failure in Better Auth, between revoking and setting.
    vi.spyOn((await useAuth()).api, 'setUserPassword').mockRejectedValueOnce(new Error('database unavailable'));

    const { status } = await accounts.call('PUT', `/api/users/${user.id}/password`, { cookie, body: { password: NEW_PASSWORD } });

    expect(status).toBe(500);
    expect((await accounts.call('GET', '/api/session', { cookie: graceCookie })).json).toBeNull();
    vi.restoreAllMocks();
  });

  it('given the administrator\'s own id, answers 409 cannot_reset_self (7)', async () => {
    const cookie = await accounts.signedIn();
    const me = (await accounts.call('GET', '/api/session', { cookie })).json as { user: { id: string } };

    const { status, json } = await accounts.call('PUT', `/api/users/${me.user.id}/password`, { cookie, body: { password: NEW_PASSWORD } });

    expect(status).toBe(409);
    expect(json).toMatchObject({ type: 'urn:stackmap:problem:cannot_reset_self' });
  });

  it('given an unknown id, answers 404 user_not_found (7)', async () => {
    const cookie = await accounts.signedIn();

    const { status, json } = await accounts.call('PUT', '/api/users/0199d6a0-0000-7000-8000-000000000999/password', {
      cookie, body: { password: NEW_PASSWORD },
    });

    expect(status).toBe(404);
    expect(json).toMatchObject({ type: 'urn:stackmap:problem:user_not_found' });
  });

  it('given a plain user, answers 403', async () => {
    await accounts.signedIn();
    const { user } = await grace();
    const cookie = await accounts.signInAs('grace@homelab.example');

    expect((await accounts.call('PUT', `/api/users/${user.id}/password`, { cookie, body: { password: NEW_PASSWORD } })).status)
      .toBe(403);
  });
});
