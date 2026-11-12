import { describe, expect, it } from 'vitest';

import { ADMIN, createAccount, useTestAccounts } from '../../../tests/support/accounts';
import { DIALECTS } from '../../../tests/support/databases';

import type { Dialect } from '../../../tests/support/databases';

describe.each(DIALECTS)('GET /api/users on %s', (dialect: Dialect) => {
  const accounts = useTestAccounts(dialect);

  it('given the instance administrator, answers every account by name with its instance role (1)', async () => {
    const cookie = await accounts.signedIn();
    const { user: grace } = await createAccount(accounts.db(), { name: 'Grace', email: 'grace@homelab.example' });

    const { status, json } = await accounts.call('GET', '/api/users', { cookie });

    expect(status).toBe(200);
    expect(json).toEqual({
      users: [
        { id: expect.any(String) as unknown, name: ADMIN.name, email: ADMIN.email, role: 'admin', createdAt: expect.any(String) as unknown },
        { id: grace.id, name: 'Grace', email: 'grace@homelab.example', role: 'user', createdAt: expect.any(String) as unknown },
      ],
    });
  });

  it('given a signed-in plain user, answers 403; signed out, 401 (1)', async () => {
    await accounts.signedIn();
    await createAccount(accounts.db(), { name: 'Grace', email: 'grace@homelab.example' });
    const cookie = await accounts.signInAs('grace@homelab.example');

    expect((await accounts.call('GET', '/api/users', { cookie })).status).toBe(403);
    expect((await accounts.call('GET', '/api/users')).status).toBe(401);
  });
});
