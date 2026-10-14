import { inspect } from 'node:util';

import { PostgresAdapter, sql } from 'kysely';
import { Migrator } from 'kysely/migration';

import { MIGRATIONS } from './migrations';

import type { Kysely } from 'kysely';
import type { Migration, MigrationResultSet, NO_MIGRATIONS } from 'kysely/migration';

type Migrations = Record<string, Migration>;

export class MigrationError extends Error {
  override name = 'MigrationError';
}

/** Kysely's message when the database recorded a migration that this version does not know. */
const MISSING_MIGRATION = /previously executed migration (\S+) is missing/;

/**
 * Kysely checks whether its migration tables exist by looking at every Postgres schema: a Kysely table in another
 * schema of the same database would make it skip creating its own. Pinning the current schema avoids that.
 */
async function migrationTableSchema<DB>(db: Kysely<DB>): Promise<string | undefined> {
  if (!(db.getExecutor().adapter instanceof PostgresAdapter)) {
    return undefined;
  }
  const { rows } = await sql<{ schema: string }>`select current_schema() as schema`.execute(db);
  return rows[0]?.schema;
}

/** Where a set of migrations records what ran: the app's history by default, or an extension's own. */
export interface MigrationHistory {
  /**
   * Suffix of the history tables: `core` gives `kysely_migration__core` and `kysely_migration_lock__core`. The double
   * underscore cannot come from a prefix, so `lock-vpn` and `vpn` never share one.
   */
  history?: string;
}

async function createMigrator<DB>(
  db: Kysely<DB>,
  migrations: Migrations,
  { history }: MigrationHistory = {},
): Promise<Migrator> {
  return new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve(migrations) },
    ...(history === undefined
      ? {}
      : {
          migrationTableName: `kysely_migration__${history}`,
          migrationLockTableName: `kysely_migration_lock__${history}`,
        }),
    migrationTableSchema: await migrationTableSchema(db),
  });
}

/** The names of the migrations that ran, or a MigrationError that explains what went wrong. */
function namesOrThrow({ error, results = [] }: MigrationResultSet): string[] {
  if (error === undefined) {
    return results.filter(({ status }) => status === 'Success').map(({ migrationName }) => migrationName);
  }
  const message = error instanceof Error ? error.message : inspect(error);
  const unknown = MISSING_MIGRATION.exec(message)?.[1];
  if (unknown) {
    throw new MigrationError(
      `This database was migrated by a newer version of Stackmap: it ran migration ${unknown}, which this version `
      + 'does not know. Upgrade Stackmap, or downgrade the database with the newer version first (migrateTo), or '
      + 'restore a backup.',
      { cause: error },
    );
  }
  const failed = results.find(({ status }) => status === 'Error')?.migrationName ?? 'unknown';
  throw new MigrationError(
    `Database migration ${failed} failed, so no migration of this run was kept: ${message}`,
    { cause: error },
  );
}

/** Applies every pending migration; resolves with the names applied, in order. */
export async function migrateToLatest<DB>(
  db: Kysely<DB>,
  migrations: Migrations = MIGRATIONS,
  history: MigrationHistory = {},
): Promise<string[]> {
  return namesOrThrow(await (await createMigrator(db, migrations, history)).migrateToLatest());
}

/** Moves the database up or down to exactly `target`; resolves with the names applied or reverted, in order. */
export async function migrateTo<DB>(
  db: Kysely<DB>,
  target: string | typeof NO_MIGRATIONS,
  migrations: Migrations = MIGRATIONS,
  history: MigrationHistory = {},
): Promise<string[]> {
  if (typeof target === 'string' && !(target in migrations)) {
    throw new MigrationError(`Unknown migration "${target}". Known migrations: ${Object.keys(migrations).join(', ')}.`);
  }
  return namesOrThrow(await (await createMigrator(db, migrations, history)).migrateTo(target));
}
