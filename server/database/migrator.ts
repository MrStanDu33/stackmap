import { MIGRATIONS } from './migrations';

import type { Kysely } from 'kysely';
import type { Migration, NO_MIGRATIONS } from 'kysely/migration';

type Migrations = Record<string, Migration>;

/** Applies every pending migration; resolves with the names applied, in order. */
export function migrateToLatest<DB>(_db: Kysely<DB>, _migrations: Migrations = MIGRATIONS): Promise<string[]> {
  return Promise.reject(new Error('Not implemented'));
}

/** Moves the database up or down to exactly `target`; resolves with the names applied or reverted, in order. */
export function migrateTo<DB>(
  _db: Kysely<DB>,
  _target: string | typeof NO_MIGRATIONS,
  _migrations: Migrations = MIGRATIONS,
): Promise<string[]> {
  return Promise.reject(new Error('Not implemented'));
}
