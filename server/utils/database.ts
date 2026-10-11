import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

/** Called once by the startup plugin with the database being prepared. */
export function setDatabase(_ready: Promise<Kysely<Database>>): void {
  throw new Error('Not implemented');
}

/** The database, once the startup plugin migrated it. */
export function useDatabase(): Promise<Kysely<Database>> {
  throw new Error('Not implemented');
}
