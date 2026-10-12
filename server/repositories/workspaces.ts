import type { Workspace, WorkspaceInput } from '../../shared/entities';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

/*
 * Workspaces are instance-level: they are not scoped, and are managed by the instance (accounts arrive in phase 4).
 */

export function createWorkspace(_db: Kysely<Database>, _input: WorkspaceInput): Promise<Workspace> {
  throw new Error('Not implemented');
}

export function getWorkspace(_db: Kysely<Database>, _id: string): Promise<Workspace | undefined> {
  throw new Error('Not implemented');
}

/** Deletes the workspace and all of its data. */
export function deleteWorkspace(_db: Kysely<Database>, _id: string): Promise<boolean> {
  throw new Error('Not implemented');
}
