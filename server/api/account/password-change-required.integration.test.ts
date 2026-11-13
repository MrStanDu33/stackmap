import { describe, expect, it } from 'vitest';

import { useTestAccounts } from '../../../tests/support/accounts';
import { DIALECTS } from '../../../tests/support/databases';

import type { Dialect } from '../../../tests/support/databases';

const TEMPORARY = 'temporary horse battery';

describe.each(DIALECTS)('a temporary password on %s', (dialect: Dialect) => {
  const accounts = useTestAccounts(dialect);
  const sessionOf = async (cookie: string) => (await accounts.call('GET', '/api/session', { cookie })).json;

  /** Grace, created on the users page by the administrator, and signed in with her temporary password. */
  const grace = async () => {
    const admin = await accounts.signedIn();
    const { json } = await accounts.call('POST', '/api/users', {
      cookie: admin, body: { name: 'Grace', email: 'grace@homelab.example', password: TEMPORARY },
    });
    return { admin, id: (json as { id: string }).id, cookie: await accounts.signInAs('grace@homelab.example', TEMPORARY) };
  };

  it('given an account created on the users page, marks it; the first administrator is not (11)', async () => {
    const { admin, cookie } = await grace();

    expect(await sessionOf(cookie)).toMatchObject({ user: { mustChangePassword: true } });
    expect(await sessionOf(admin)).toMatchObject({ user: { mustChangePassword: false } });
  });

  it('given a temporary password set on the users page, marks the account (11)', async () => {
    const { admin, id, cookie } = await grace();
    await accounts.call('PUT', '/api/account/password', { cookie, body: { currentPassword: TEMPORARY, newPassword: 'her own horse battery' } });

    await accounts.call('PUT', `/api/users/${id}/password`, { cookie: admin, body: { password: 'another temporary one' } });

    expect(await sessionOf(await accounts.signInAs('grace@homelab.example', 'another temporary one')))
      .toMatchObject({ user: { mustChangePassword: true } });
  });

  it('given a marked account, answers 403 password_change_required on other operations, before parsing the input (12)', async () => {
    const { cookie } = await grace();

    for (const [method, path, body] of [
      ['GET', '/api/workspaces', undefined],
      ['PUT', '/api/account/preferences', { theme: 'not a theme' }],
    ] as const) {
      const { status, json } = await accounts.call(method, path, { cookie, body });
      expect(status).toBe(403);
      expect(json).toMatchObject({ type: 'urn:stackmap:problem:password_change_required' });
    }
  });

  it('given a marked account, reading the session, changing the password and signing out still work (12)', async () => {
    const { cookie } = await grace();
    const other = await accounts.signInAs('grace@homelab.example', TEMPORARY);

    expect(await sessionOf(cookie)).not.toBeNull();
    expect((await accounts.call('DELETE', '/api/session', { cookie: other })).status).toBe(200);
    const changed = await accounts.call('PUT', '/api/account/password', {
      cookie, body: { currentPassword: TEMPORARY, newPassword: 'her own horse battery' },
    });
    expect(changed.status).toBe(204);
  });
});
