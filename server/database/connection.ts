import type { DatabaseConfig } from './config';
import type { Database } from './types/schema';
import type { Kysely } from 'kysely';

/** Opens the database and checks that it answers. */
export function connectDatabase(_config: DatabaseConfig): Promise<Kysely<Database>> {
  return Promise.reject(new Error('Not implemented'));
}
