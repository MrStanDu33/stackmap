import { sql } from 'kysely';

import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/**
 * Pending invitations to a workspace. The link's token is never stored, only its SHA-256 hash; one invitation per
 * email and workspace, replaced when sent again, deleted once used.
 */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable('invitation')
      .addColumn('id', 'text', (column) => column.primaryKey().notNull())
      .addColumn('workspaceId', 'text', (column) => column.notNull())
      .addColumn('email', 'text', (column) => column.notNull())
      .addColumn('role', 'text', (column) => column.notNull())
      .addColumn('tokenHash', 'text', (column) => column.notNull().unique())
      .addColumn('invitedById', 'text')
      .addColumn('createdAt', 'text', (column) => column.notNull())
      .addColumn('expiresAt', 'text', (column) => column.notNull())
      .addUniqueConstraint('invitation_workspace_email_key', ['workspaceId', 'email'])
      .addForeignKeyConstraint(
        'invitation_workspace_fkey', ['workspaceId'], 'workspace', ['id'], (key) => key.onDelete('cascade'),
      )
      .addForeignKeyConstraint('invitation_inviter_fkey', ['invitedById'], 'user', ['id'], (key) => key.onDelete('set null'))
      .addCheckConstraint('invitation_role_check', sql`role in ('owner', 'admin', 'editor', 'viewer')`)
      .execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('invitation').execute();
  },
};
