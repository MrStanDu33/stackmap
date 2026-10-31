import { sql } from 'kysely';

import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

interface Tables {
  workspace: { id: string };
  user: { id: string; role: string | null };
  member: { workspaceId: string; userId: string; role: string; createdAt: string };
}

/**
 * Workspace memberships: who belongs to which workspace, with which role. Instances set up before memberships existed
 * get their administrators as owners of every workspace, so nobody loses access.
 */
export const migration: Migration = {
  up: async (untyped: Kysely<unknown>) => {
    const db = untyped as Kysely<Tables>;
    await db.schema
      .createTable('member')
      .addColumn('workspaceId', 'text', (column) => column.notNull())
      .addColumn('userId', 'text', (column) => column.notNull())
      .addColumn('role', 'text', (column) => column.notNull())
      .addColumn('createdAt', 'text', (column) => column.notNull())
      .addPrimaryKeyConstraint('member_pkey', ['workspaceId', 'userId'])
      .addForeignKeyConstraint(
        'member_workspace_fkey', ['workspaceId'], 'workspace', ['id'], (key) => key.onDelete('cascade'),
      )
      .addForeignKeyConstraint('member_user_fkey', ['userId'], 'user', ['id'], (key) => key.onDelete('cascade'))
      .addCheckConstraint('member_role_check', sql`role in ('owner', 'admin', 'editor', 'viewer')`)
      .execute();
    await db.schema.createIndex('member_userId_idx').on('member').column('userId').execute();

    const now = new Date().toISOString();
    await db.insertInto('member')
      .columns(['workspaceId', 'userId', 'role', 'createdAt'])
      .expression((eb) => eb.selectFrom(['workspace', 'user'])
        .select([
          'workspace.id as workspaceId', 'user.id as userId', sql.lit('owner').as('role'), sql.val(now).as('createdAt'),
        ])
        .where('user.role', '=', 'admin'))
      .execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('member').execute();
  },
};
