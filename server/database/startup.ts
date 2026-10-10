import { MIGRATIONS } from './migrations';

import type { DatabaseEnv } from './config';
import type { Database } from './types/schema';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export interface Logger {
  info: (message: string) => void;
}

/** Connects to the configured database and applies pending migrations, before the app serves requests. */
export function prepareDatabase(
  _env: DatabaseEnv,
  _logger: Logger,
  _migrations: Record<string, Migration> = MIGRATIONS,
): Promise<Kysely<Database>> {
  return Promise.reject(new Error('Not implemented'));
}
