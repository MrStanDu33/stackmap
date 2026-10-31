import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTestAccounts } from '../../tests/support/accounts';
import { DIALECTS } from '../../tests/support/databases';
import { markServerStart } from '../auth/setup-window';

import type { Dialect } from '../../tests/support/databases';

describe.each(DIALECTS)('GET /api/setup on %s', (dialect: Dialect) => {
  const accounts = useTestAccounts(dialect);

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('given no account within the setup window, answers open (1)', async () => {
    const { status, json } = await accounts.call('GET', '/api/setup');

    expect(status).toBe(200);
    expect(json).toEqual({ state: 'open', minutes: 15 });
  });

  it('given no account after the setup window, answers closed, with SETUP_TIMEOUT_MINUTES (6)', async () => {
    vi.stubEnv('SETUP_TIMEOUT_MINUTES', '5');
    markServerStart(new Date(Date.now() - 6 * 60_000));

    expect((await accounts.call('GET', '/api/setup')).json).toEqual({ state: 'closed', minutes: 5 });
  });

  it('given an account, answers done (4)', async () => {
    await accounts.signedIn();

    expect((await accounts.call('GET', '/api/setup')).json).toEqual({ state: 'done', minutes: 15 });
  });
});
