import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import BetterSqlite3 from 'better-sqlite3';
import { Kysely, PostgresDialect, sql, SqliteAdapter, SqliteDialect } from 'kysely';
import pg from 'pg';

import type { DatabaseConfig } from './config';
import type { Database } from './types/schema';

export class DatabaseConnectionError extends Error {
  override name = 'DatabaseConnectionError';
}

const SQLITE_BUSY_TIMEOUT_MS = 5000;
const POSTGRES_POOL_SIZE = 10;

/** SQLite runs DDL in transactions, so a failed migration rolls back; Kysely's adapter just doesn't say so. */
class TransactionalSqliteAdapter extends SqliteAdapter {
  override get supportsTransactionalDdl(): boolean {
    return true;
  }
}

class TransactionalSqliteDialect extends SqliteDialect {
  override createAdapter(): SqliteAdapter {
    return new TransactionalSqliteAdapter();
  }
}

function openSqlite(path: string): Kysely<Database> {
  let database: BetterSqlite3.Database;
  try {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }
    database = new BetterSqlite3(path);
  } catch (error) {
    throw new DatabaseConnectionError(
      `Cannot open the SQLite database at ${path}: ${(error as Error).message}. Check that its directory is writable `
      + 'by the user running Stackmap (PUID and PGID in Docker).',
      { cause: error },
    );
  }
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma(`busy_timeout = ${String(SQLITE_BUSY_TIMEOUT_MS)}`);
  return new Kysely<Database>({ dialect: new TransactionalSqliteDialect({ database }) });
}

function openPostgres(url: string): Kysely<Database> {
  const pool = new pg.Pool({ connectionString: url, max: POSTGRES_POOL_SIZE });
  // An idle client can lose its connection (e.g. Postgres restarts); log it instead of crashing the process.
  pool.on('error', (error) => {
    console.error(`Postgres connection error: ${error.message}`);
  });
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}

/** Where the database is, for messages: never includes the Postgres password. */
function describeLocation(config: DatabaseConfig): string {
  if (config.dialect === 'sqlite') {
    return `SQLite at ${config.path}`;
  }
  const { hostname, port } = new URL(config.url);
  return `Postgres at ${hostname}:${port || '5432'}`;
}

/** Opens the database and checks that it answers. */
export async function connectDatabase(config: DatabaseConfig): Promise<Kysely<Database>> {
  const db = config.dialect === 'sqlite' ? openSqlite(config.path) : openPostgres(config.url);
  try {
    await pingDatabase(db);
    return db;
  } catch (error) {
    await db.destroy();
    throw new DatabaseConnectionError(
      `Cannot connect to ${describeLocation(config)}: ${(error as Error).message}`,
      { cause: error },
    );
  }
}

/** Checks that the database answers. */
export async function pingDatabase(db: Kysely<Database>): Promise<void> {
  await sql`select 1`.execute(db);
}
