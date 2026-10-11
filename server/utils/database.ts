import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

let ready: Promise<Kysely<Database>> | undefined;

/** Called once by the startup plugin with the database being prepared. */
export function setDatabase(database: Promise<Kysely<Database>>): void {
  ready = database;
}

/** The database, once the startup plugin migrated it. */
export function useDatabase(): Promise<Kysely<Database>> {
  if (!ready) {
    throw new Error('The database is not ready: the startup plugin (server/plugins/database.ts) has not run.');
  }
  return ready;
}
