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
      .toEqual({ theme: 'light', contrast: null, locale: 'fr', landingPage: 'trace', palette: { hidden: [] } });
    // null forgets a choice: the browser's own applies again.
    expect((await save(cookie, { theme: null, contrast: 'strict' })).json)
      .toEqual({ theme: null, contrast: 'strict', locale: 'fr', landingPage: 'trace', palette: { hidden: [] } });
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

  it('saves palette.hidden and answers it with the other preferences, which stay as they were (13)', async () => {
    const cookie = await accounts.signedIn();
    await save(cookie, { theme: 'light' });
    const palette = { hidden: ['group:pages', 'extension:nat', 'type:nat/port-forward'] };

    expect(await save(cookie, { palette }))
      .toMatchObject({ status: 200, json: { theme: 'light', contrast: null, locale: null, landingPage: null, palette } });
    expect((await save(cookie, { palette: { hidden: [] } })).json).toMatchObject({ theme: 'light', palette: { hidden: [] } });
  });

  it.each([
    ['an unknown group', { hidden: ['group:files'] }, 'body.palette.hidden.0'],
    ['something else', { hidden: ['nonsense'] }, 'body.palette.hidden.0'],
    ['a key over 100 characters', { hidden: [`extension:${'a'.repeat(91)}`] }, 'body.palette.hidden.0'],
    ['more than 200 keys', { hidden: Array.from({ length: 201 }, (_, index) => `extension:e${String(index)}`) }, 'body.palette.hidden'],
    ['an unknown field', { shown: [] }, 'body.palette'],
  ])('given %s in palette, answers 400 on it (13)', async (_case, palette, path) => {
    const cookie = await accounts.signedIn();

    const { status, json } = await save(cookie, { palette });

    expect(status).toBe(400);
    expect((json as { issues: { path: string }[] }).issues.map((issue) => issue.path)).toEqual([path]);
  });

  it('signed out, answers 401 (2)', async () => {
    await accounts.signedIn();

    expect((await accounts.call('PUT', '/api/account/preferences', { body: { theme: 'light' } })).status).toBe(401);
  });
});
