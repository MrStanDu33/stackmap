import { parseEntity } from './entity-repository';
import { EntityConflictError } from './errors';
import { workspaceSchema } from '../../shared/entities';
import { isUniqueViolation } from '../database/errors';
import { newId } from '../database/ids';
import { fromTimestamp, toTimestamp } from '../database/serialize';

import type { Workspace, WorkspaceInput } from '../../shared/entities';
import type { Database, WorkspaceTable } from '../database/types/schema';
import type { Kysely } from 'kysely';

/*
 * Workspaces are instance-level: they are not scoped, and are managed by the instance (accounts arrive in phase 4).
 */

const COLUMNS = ['id', 'name', 'slug', 'createdAt', 'updatedAt'] as const;

const fromRow = (row: WorkspaceTable): Workspace => ({
  ...row,
  createdAt: fromTimestamp(row.createdAt, 'workspace.createdAt'),
  updatedAt: fromTimestamp(row.updatedAt, 'workspace.updatedAt'),
});

export async function createWorkspace(db: Kysely<Database>, input: WorkspaceInput): Promise<Workspace> {
  const { name, slug } = parseEntity(workspaceSchema, input);
  const now = toTimestamp(new Date());
  const row = { id: newId(), name, slug, createdAt: now, updatedAt: now };
  try {
    await db.insertInto('workspace').values(row).execute();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new EntityConflictError(['slug']);
    }
    throw error;
  }
  return fromRow(row);
}

export async function getWorkspace(db: Kysely<Database>, id: string): Promise<Workspace | undefined> {
  const row = await db.selectFrom('workspace').select(COLUMNS).where('id', '=', id).executeTakeFirst();
  return row && fromRow(row);
}

/** Deletes the workspace and all of its data. */
export async function deleteWorkspace(db: Kysely<Database>, id: string): Promise<boolean> {
  const { numDeletedRows } = await db.deleteFrom('workspace').where('id', '=', id).executeTakeFirstOrThrow();
  return numDeletedRows > 0n;
}
