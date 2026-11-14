import { sql } from 'kysely';

import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/**
 * Who wrote which entity, when, and the names of the fields it changed: never their values, which may be secrets.
 * The entity id has no foreign key, as the entity may be gone; a deleted account leaves its events without an actor.
 */
export const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable('audit_event')
      .addColumn('id', 'text', (column) => column.primaryKey().notNull())
      .addColumn('workspaceId', 'text', (column) => column.notNull())
      .addColumn('actorId', 'text')
      .addColumn('action', 'text', (column) => column.notNull())
      .addColumn('extension', 'text', (column) => column.notNull())
      .addColumn('entity', 'text', (column) => column.notNull())
      .addColumn('entityId', 'text', (column) => column.notNull())
      .addColumn('fields', 'text', (column) => column.notNull())
      .addColumn('createdAt', 'text', (column) => column.notNull())
      .addForeignKeyConstraint(
        'audit_event_workspace_fkey', ['workspaceId'], 'workspace', ['id'], (key) => key.onDelete('cascade'),
      )
      .addForeignKeyConstraint('audit_event_actor_fkey', ['actorId'], 'user', ['id'], (key) => key.onDelete('set null'))
      .addCheckConstraint('audit_event_action_check', sql`action in ('create', 'update', 'delete')`)
      .execute();
    await db.schema.createIndex('audit_event_workspace_created_idx').on('audit_event')
      .columns(['workspaceId', 'createdAt'])
      .execute();
  },
  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable('audit_event').execute();
  },
};
