import type { Preferences } from '../../shared/contracts/preferences';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

/** A person's preferences; every field null until chosen. Instance-level: they follow the account. */
export function preferencesOf(_db: Kysely<Database>, _userId: string): Promise<Preferences> {
  throw new Error('Not implemented');
}

/** Saves the given preferences (undefined leaves one as it is, null forgets it) and answers all four. */
export function savePreferences(
  _db: Kysely<Database>,
  _userId: string,
  _changes: Partial<Preferences>,
): Promise<Preferences> {
  throw new Error('Not implemented');
}
