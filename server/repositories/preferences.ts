import { NO_PREFERENCES } from '../../shared/contracts/preferences';

import type { Preferences } from '../../shared/contracts/preferences';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

const COLUMNS = ['theme', 'contrast', 'locale', 'landingPage'] as const;

// The database checks each column against its choices (0007_user_settings), so a stored value is one of them.
const toPreferences = (row?: Record<(typeof COLUMNS)[number], string | null>): Preferences =>
  (row ? { ...NO_PREFERENCES, ...row } as Preferences : NO_PREFERENCES);

/** A person's preferences; every field null until chosen. Instance-level: they follow the account. */
export async function preferencesOf(db: Kysely<Database>, userId: string): Promise<Preferences> {
  return toPreferences(await db.selectFrom('userPreference').select(COLUMNS).where('userId', '=', userId).executeTakeFirst());
}

/** Saves the given preferences (undefined leaves one as it is, null forgets it) and answers all four. */
export async function savePreferences(
  db: Kysely<Database>,
  userId: string,
  changes: Partial<Preferences>,
): Promise<Preferences> {
  const given = Object.fromEntries(COLUMNS.filter((column) => changes[column] !== undefined)
    .map((column) => [column, changes[column] ?? null]));
  const updatedAt = new Date().toISOString();
  const row = await db.insertInto('userPreference')
    .values({ ...NO_PREFERENCES, ...given, userId, updatedAt })
    .onConflict((conflict) => conflict.column('userId').doUpdateSet({ ...given, updatedAt }))
    .returning(COLUMNS)
    .executeTakeFirstOrThrow();
  return toPreferences(row);
}
