import type { CreateTableBuilder } from 'kysely';

/*
 * Columns every entity table has, shared by the migrations that create them. Never change it: an existing database
 * already has these columns, so a change goes in a new migration.
 */

type EntityColumn = 'id' | 'workspaceId' | 'status' | 'tags' | 'notes' | 'links' | 'customFields' | 'origin'
  | 'externalRef' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt';

/**
 * Adds the common entity columns, and `unique (workspaceId, id)`, which composite foreign keys point to so that a row
 * can only refer to a row of its own workspace.
 */
export function withEntityColumns<T extends string>(
  table: CreateTableBuilder<T>,
  name: string,
): CreateTableBuilder<T, EntityColumn> {
  return table
    // SQLite allows NULL in a text primary key unless it is declared NOT NULL.
    .addColumn('id', 'text', (column) => column.primaryKey().notNull())
    .addColumn('workspaceId', 'text', (column) => column.notNull().references('workspace.id').onDelete('cascade'))
    .addColumn('status', 'text', (column) => column.notNull())
    .addColumn('tags', 'text', (column) => column.notNull())
    .addColumn('notes', 'text', (column) => column.notNull())
    .addColumn('links', 'text', (column) => column.notNull())
    .addColumn('customFields', 'text', (column) => column.notNull())
    .addColumn('origin', 'text', (column) => column.notNull())
    .addColumn('externalRef', 'text')
    .addColumn('createdBy', 'text')
    .addColumn('updatedBy', 'text')
    .addColumn('createdAt', 'text', (column) => column.notNull())
    .addColumn('updatedAt', 'text', (column) => column.notNull())
    .addUniqueConstraint(`${name}_workspace_id_unique`, ['workspaceId', 'id']);
}
