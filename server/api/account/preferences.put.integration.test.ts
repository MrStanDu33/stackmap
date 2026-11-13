import { describe, expect, it } from 'vitest';

import { useTestAccounts } from '../../../tests/support/accounts';
import { DIALECTS } from '../../../tests/support/databases';

import type { Dialect } from '../../../tests/support/databases';

describe.each(DIALECTS)('PUT /api/account/preferences on %s', (dialect: Dialect) => {
  const accounts = useTestAccounts(dialect);
  const save = (cookie: string, body: unknown) => accounts.call('PUT', '/api/account/preferences', { cookie, body });

  it('given any subset of the four preferences, answers 200 with all four, the others unchanged (2)', async () => {
    const cookie = await accounts.signedIn();

    expect(await save(cookie, { theme: 'light' }))
      .toMatchObject({ status: 200, json: { theme: 'light', contrast: null, locale: null, landingPage: null } });
    expect((await save(cookie, { locale: 'fr', landingPage: 'trace' })).json)
      .toEqual({ theme: 'light', contrast: null, locale: 'fr', landingPage: 'trace' });
    // null forgets a choice: the browser's own applies again.
    expect((await save(cookie, { theme: null, contrast: 'strict' })).json)
      .toEqual({ theme: null, contrast: 'strict', locale: 'fr', landingPage: 'trace' });
  });

  it.each([
    ['a theme', { theme: 'pink' }, 'body.theme'],
    ['a contrast', { contrast: 'high' }, 'body.contrast'],
    ['a locale', { locale: 'de' }, 'body.locale'],
    ['a landing page', { landingPage: 'inventory' }, 'body.landingPage'],
    ['an unknown field', { font: 'large' }, 'body'],
  ])('given %s outside its choices, answers 400 on that field (2)', async (_case, body, path) => {
    const cookie = await accounts.signedIn();

    const { status, json } = await save(cookie, body);

    expect(status).toBe(400);
    expect((json as { issues: { path: string }[] }).issues.map((issue) => issue.path)).toEqual([path]);
  });

  it('signed out, answers 401 (2)', async () => {
    await accounts.signedIn();

    expect((await accounts.call('PUT', '/api/account/preferences', { body: { theme: 'light' } })).status).toBe(401);
  });
});
