import { describe, expect, it } from 'vitest';

import { preferencesOf, savePreferences } from './preferences';
import { NO_PREFERENCES } from '../../shared/contracts/preferences';
import { createAccount } from '../../tests/support/accounts';
import { DIALECTS } from '../../tests/support/databases';
import { useTestWorkspaces } from '../../tests/support/workspaces';

import type { Dialect } from '../../tests/support/databases';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

describe.each(DIALECTS)('preferences repository on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const grace = async () => (await createAccount(db(), { name: 'Grace', email: 'grace@homelab.example' })).user;

  it('given no saved preferences, answers every field null (1)', async () => {
    const { id } = await grace();

    expect(await preferencesOf(db(), id)).toEqual(NO_PREFERENCES);
  });

  it('saves a subset and keeps the others, creating the row on first save (2)', async () => {
    const { id } = await grace();

    expect(await savePreferences(db(), id, { theme: 'light' })).toEqual({ ...NO_PREFERENCES, theme: 'light' });
    expect(await savePreferences(db(), id, { locale: 'fr', theme: undefined }))
      .toEqual({ ...NO_PREFERENCES, theme: 'light', locale: 'fr' });
    expect(await preferencesOf(db(), id)).toEqual({ ...NO_PREFERENCES, theme: 'light', locale: 'fr' });
  });

  it('refuses a value outside its choices in the database too (2)', async () => {
    const { id } = await grace();

    await expect(db().insertInto('userPreference')
      .values({ userId: id, theme: 'pink', contrast: null, locale: null, landingPage: null, updatedAt: new Date().toISOString() })
      .execute()).rejects.toThrow();
  });

  it('deletes the preferences with their account', async () => {
    const { id } = await grace();
    await savePreferences(db(), id, { theme: 'light' });

    await db().deleteFrom('user').where('id', '=', id).execute();

    expect(await db().selectFrom('userPreference').select('userId').execute()).toEqual([]);
  });
});
