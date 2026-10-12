import { randomUUID } from 'node:crypto';

import { sql } from 'kysely';
import { inject } from 'vitest';

import { connectDatabase } from '../../server/database/connection';

import type { DatabaseConfig } from '../../server/database/config';
import type { Database } from '../../server/database/types/schema';
import type {} from './provided-context';
import type { Kysely } from 'kysely';

export type Dialect = DatabaseConfig['dialect'];

/** SQLite always; Postgres when the integration setup found one (see tests/support/integration-setup.ts). */
export const DIALECTS: Dialect[] = inject('postgresUrl') ? ['sqlite', 'postgres'] : ['sqlite'];

export interface TestDatabase {
  db: Kysely<Database>;
  config: DatabaseConfig;
  /** Opens another, independent connection to the same database (e.g. a second app instance). */
  reopen: () => Promise<Kysely<Database>>;
  cleanup: () => Promise<void>;
}

const withSearchPath = (url: string, schema: string): string => {
  const parsed = new URL(url);
  parsed.searchParams.set('options', `-c search_path=${schema}`);
  return parsed.toString();
};

let workerDatabase: Promise<string> | undefined;

/**
 * The URL of this Vitest worker's own Postgres database, created on first use. A worker runs one test at a time, so no
 * schema is dropped while another test introspects: Kysely's Postgres introspection resolves every schema of the
 * database by name, and fails when one disappears during the query.
 */
function workerDatabaseUrl(baseUrl: string): Promise<string> {
  workerDatabase ??= (async () => {
    const url = new URL(baseUrl);
    const name = `${url.pathname.slice(1)}_${process.env.VITEST_POOL_ID ?? '0'}`;
    const admin = await connectDatabase({ dialect: 'postgres', url: baseUrl });
    try {
      const { rows } = await sql`select 1 from pg_database where datname = ${name}`.execute(admin);
      if (rows.length === 0) {
        // Another run with the same pool id (an IDE runner and the CLI) may create it at the same time.
        await sql`create database ${sql.id(name)}`.execute(admin).catch((error: unknown) => {
          if ((error as { code?: unknown }).code !== '42P04') {
            throw error;
          }
        });
      }
    } finally {
      await admin.destroy();
    }
    url.pathname = `/${name}`;
    return url.toString();
  })();
  return workerDatabase;
}

/**
 * A fresh, isolated database: an in-memory SQLite, or a dedicated Postgres schema dropped by `cleanup`, in a database
 * of the worker's own.
 * `reopen` gives another connection to the same Postgres schema (for SQLite in memory, it is a new database).
 */
export async function openTestDatabase(dialect: Dialect): Promise<TestDatabase> {
  if (dialect === 'sqlite') {
    const config: DatabaseConfig = { dialect: 'sqlite', path: ':memory:' };
    const opened: Kysely<Database>[] = [await connectDatabase(config)];
    return {
      db: opened[0]!,
      config,
      reopen: async () => {
        const db = await connectDatabase(config);
        opened.push(db);
        return db;
      },
      cleanup: async () => {
        await Promise.all(opened.map((db) => db.destroy()));
      },
    };
  }

  const postgresUrl = inject('postgresUrl');
  if (!postgresUrl) {
    throw new Error('Postgres is not available to the integration tests.');
  }
  const baseUrl = await workerDatabaseUrl(postgresUrl);
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const admin = await connectDatabase({ dialect: 'postgres', url: baseUrl });
  await sql`create schema ${sql.id(schema)}`.execute(admin);

  const config: DatabaseConfig = { dialect: 'postgres', url: withSearchPath(baseUrl, schema) };
  const opened: Kysely<Database>[] = [await connectDatabase(config)];
  return {
    db: opened[0]!,
    config,
    reopen: async () => {
      const db = await connectDatabase(config);
      opened.push(db);
      return db;
    },
    cleanup: async () => {
      await Promise.all(opened.map((db) => db.destroy()));
      await sql`drop schema ${sql.id(schema)} cascade`.execute(admin);
      await admin.destroy();
    },
  };
}

export interface ColumnShape {
  name: string;
  nullable: boolean;
  primaryKey: boolean;
}

/**
 * Tables and columns of the application schema, normalized so SQLite and Postgres can be compared.
 * Kysely's own migration tables are left out.
 */
export async function describeSchema(db: Kysely<Database>, dialect: Dialect): Promise<Record<string, ColumnShape[]>> {
  // Postgres introspection lists every schema of the database; keep the test's own.
  const current = dialect === 'postgres'
    ? (await sql<{ schema: string }>`select current_schema() as schema`.execute(db)).rows[0]?.schema
    : undefined;
  const tables = (await db.introspection.getTables())
    .filter(({ name, schema }) => !name.startsWith('kysely_') && (dialect === 'sqlite' || schema === current));

  const shapes = await Promise.all(tables.map(async (table) => {
    const primaryKeys = await primaryKeyColumns(db, dialect, table.name);
    const columns = table.columns
      .map(({ name, isNullable }) => ({ name, nullable: isNullable, primaryKey: primaryKeys.includes(name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [table.name, columns] as const;
  }));
  return Object.fromEntries(shapes.sort(([a], [b]) => a.localeCompare(b)));
}

async function primaryKeyColumns(db: Kysely<Database>, dialect: Dialect, table: string): Promise<string[]> {
  if (dialect === 'sqlite') {
    const { rows } = await sql<{ name: string; pk: number }>`select name, pk from pragma_table_info(${table})`
      .execute(db);
    return rows.filter(({ pk }) => pk > 0).map(({ name }) => name);
  }
  const { rows } = await sql<{ name: string }>`
    select kcu.column_name as name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    where tc.constraint_type = 'PRIMARY KEY' and tc.table_name = ${table} and tc.table_schema = current_schema()
  `.execute(db);
  return rows.map(({ name }) => name);
}
