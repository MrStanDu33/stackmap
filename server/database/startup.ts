import { resolveDatabaseConfig } from './config';
import { connectDatabase } from './connection';
import { MIGRATIONS } from './migrations';
import { migrateToLatest } from './migrator';

import type { DatabaseEnv } from './config';
import type { Database } from './types/schema';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export interface Logger {
  info: (message: string) => void;
}

/** Connects to the configured database and applies pending migrations, before the app serves requests. */
export async function prepareDatabase(
  env: DatabaseEnv,
  logger: Logger,
  migrations: Record<string, Migration> = MIGRATIONS,
): Promise<Kysely<Database>> {
  const db = await connectDatabase(resolveDatabaseConfig(env));
  try {
    const applied = await migrateToLatest(db, migrations);
    logger.info(applied.length > 0
      ? `Applied database migrations: ${applied.join(', ')}`
      : 'Database schema is up to date');
    return db;
  } catch (error) {
    await db.destroy();
    throw error;
  }
}
