import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/**
 * Better Auth's tables (`npx @better-auth/cli generate`), with its admin plugin's columns and the rate limiter's table,
 * read and written only by Better Auth (server/auth/). One code path: SQLite takes the Postgres type names, and
 * Better Auth's adapter stores dates as text and booleans as integers there.
 */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable('user')
      .addColumn('id', 'text', (column) => column.primaryKey().notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('email', 'text', (column) => column.notNull().unique())
      .addColumn('emailVerified', 'boolean', (column) => column.notNull())
      .addColumn('image', 'text')
      .addColumn('createdAt', 'timestamptz', (column) => column.notNull())
      .addColumn('updatedAt', 'timestamptz', (column) => column.notNull())
      .addColumn('role', 'text')
      .addColumn('banned', 'boolean')
      .addColumn('banReason', 'text')
      .addColumn('banExpires', 'timestamptz')
      .execute();
    await db.schema
      .createTable('session')
      .addColumn('id', 'text', (column) => column.primaryKey().notNull())
      .addColumn('expiresAt', 'timestamptz', (column) => column.notNull())
      .addColumn('token', 'text', (column) => column.notNull().unique())
      .addColumn('createdAt', 'timestamptz', (column) => column.notNull())
      .addColumn('updatedAt', 'timestamptz', (column) => column.notNull())
      .addColumn('ipAddress', 'text')
      .addColumn('userAgent', 'text')
      .addColumn('userId', 'text', (column) => column.notNull().references('user.id').onDelete('cascade'))
      .addColumn('impersonatedBy', 'text')
      .execute();
    await db.schema
      .createTable('account')
      .addColumn('id', 'text', (column) => column.primaryKey().notNull())
      .addColumn('accountId', 'text', (column) => column.notNull())
      .addColumn('providerId', 'text', (column) => column.notNull())
      .addColumn('userId', 'text', (column) => column.notNull().references('user.id').onDelete('cascade'))
      .addColumn('accessToken', 'text')
      .addColumn('refreshToken', 'text')
      .addColumn('idToken', 'text')
      .addColumn('accessTokenExpiresAt', 'timestamptz')
      .addColumn('refreshTokenExpiresAt', 'timestamptz')
      .addColumn('scope', 'text')
      .addColumn('password', 'text')
      .addColumn('createdAt', 'timestamptz', (column) => column.notNull())
      .addColumn('updatedAt', 'timestamptz', (column) => column.notNull())
      .execute();
    await db.schema
      .createTable('verification')
      .addColumn('id', 'text', (column) => column.primaryKey().notNull())
      .addColumn('identifier', 'text', (column) => column.notNull())
      .addColumn('value', 'text', (column) => column.notNull())
      .addColumn('expiresAt', 'timestamptz', (column) => column.notNull())
      .addColumn('createdAt', 'timestamptz', (column) => column.notNull())
      .addColumn('updatedAt', 'timestamptz', (column) => column.notNull())
      .execute();
    await db.schema
      .createTable('rateLimit')
      .addColumn('id', 'text', (column) => column.primaryKey().notNull())
      .addColumn('key', 'text', (column) => column.notNull().unique())
      .addColumn('count', 'integer', (column) => column.notNull())
      .addColumn('lastRequest', 'bigint', (column) => column.notNull())
      .execute();
    await db.schema.createIndex('session_userId_idx').on('session').column('userId').execute();
    await db.schema.createIndex('account_userId_idx').on('account').column('userId').execute();
    await db.schema.createIndex('verification_identifier_idx').on('verification').column('identifier').execute();
  },
  down: async (db: Kysely<unknown>) => {
    for (const table of ['rateLimit', 'verification', 'account', 'session', 'user']) {
      await db.schema.dropTable(table).execute();
    }
  },
};
