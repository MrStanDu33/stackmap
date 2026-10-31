import { useDatabase } from './database';
import { createAuth } from '../auth/auth';
import { loadAuthSecret } from '../auth/secret';

import type { Auth } from '../auth/auth';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

const DEFAULT_URL = 'http://localhost:3000';

// One instance per database: tests swap databases, the app has one.
let instances = new WeakMap<Kysely<Database>, Promise<Auth>>();

/** Better Auth, on the app's database, built on first use from BETTER_AUTH_URL and the secret. */
export async function useAuth(): Promise<Auth> {
  const db = await useDatabase();
  let auth = instances.get(db);
  if (!auth) {
    auth = loadAuthSecret({ env: { BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET }, dataDir: process.env.DATA_DIR?.trim() || 'data' })
      .then((secret) => createAuth(db, { secret, baseURL: process.env.BETTER_AUTH_URL?.trim() || DEFAULT_URL }));
    instances.set(db, auth);
  }
  return auth;
}

/** For tests: drops the Better Auth instances, so the next request builds one from the current environment. */
export function resetAuth(): void {
  instances = new WeakMap();
}
