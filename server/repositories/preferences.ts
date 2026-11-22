import { MAX_PALETTE_HIDDEN, NO_PREFERENCES, PalettePreferences } from '../../shared/contracts/preferences';
import { fromJson, toJson } from '../database/serialize';

import type { Preferences } from '../../shared/contracts/preferences';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

const CHOICES = ['theme', 'contrast', 'locale', 'landingPage'] as const;
const COLUMNS = [...CHOICES, 'paletteHidden'] as const;
type Row = Record<(typeof COLUMNS)[number], string | null>;

const KEY = PalettePreferences.shape.hidden.element;

/**
 * The palette's stored keys, filtered rather than checked: one no longer valid (an older dump, a contract tightened
 * since) is dropped, never thrown, as every request of the account reads its preferences, signing in among them.
 */
const hiddenOf = (stored: string | null): string[] => {
  let value: unknown;
  try {
    value = stored === null ? [] : fromJson(stored, 'userPreference.paletteHidden');
  } catch {
    return [];
  }
  const keys = Array.isArray(value) ? value.filter((key): key is string => KEY.safeParse(key).success) : [];
  return [...new Set(keys)].slice(0, MAX_PALETTE_HIDDEN);
};

// The database checks each choice against its values (0007_user_settings), so a stored value is one of them.
const toPreferences = (row?: Row): Preferences => {
  if (!row) {
    return NO_PREFERENCES;
  }
  const { paletteHidden, ...choices } = row;
  return { ...NO_PREFERENCES, ...choices, palette: { hidden: hiddenOf(paletteHidden) } } as Preferences;
};

/** A person's preferences; every choice null, nothing hidden, until chosen. They follow the account. */
export async function preferencesOf(db: Kysely<Database>, userId: string): Promise<Preferences> {
  return toPreferences(await db.selectFrom('userPreference').select(COLUMNS).where('userId', '=', userId).executeTakeFirst());
}

/** Saves the given preferences (undefined leaves one as it is, null forgets it) and answers them all. */
export async function savePreferences(
  db: Kysely<Database>,
  userId: string,
  changes: Partial<Preferences>,
): Promise<Preferences> {
  const given = {
    ...Object.fromEntries(CHOICES.filter((column) => changes[column] !== undefined)
      .map((column) => [column, changes[column] ?? null])),
    ...(changes.palette ? { paletteHidden: toJson(changes.palette.hidden) } : {}),
  };
  const updatedAt = new Date().toISOString();
  const { palette: _palette, ...none } = NO_PREFERENCES;
  const row = await db.insertInto('userPreference')
    .values({ ...none, paletteHidden: null, ...given, userId, updatedAt })
    .onConflict((conflict) => conflict.column('userId').doUpdateSet({ ...given, updatedAt }))
    .returning(COLUMNS)
    .executeTakeFirstOrThrow();
  return toPreferences(row);
}
