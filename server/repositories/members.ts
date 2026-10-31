import type { WorkspaceRole } from '../../shared/contracts/contract';
import type { Workspace, WorkspaceInput } from '../../shared/workspace';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

/*
 * Who belongs to which workspace. A workspace's data is reachable only through a membership (or, with
 * INSTANCE_ADMIN_ALL_WORKSPACES, as the instance administrator).
 */

export type MemberWorkspace = Workspace & { role: WorkspaceRole };

const notYet = (): never => {
  throw new Error('Not implemented');
};

export function addMember(
  _db: Kysely<Database>,
  _member: { workspaceId: string; userId: string; role: WorkspaceRole },
): Promise<void> {
  return notYet();
}

/** The user's role in the workspace, or undefined when they are not a member (or it does not exist). */
export function roleIn(
  _db: Kysely<Database>,
  _userId: string,
  _workspaceId: string,
): Promise<WorkspaceRole | undefined> {
  return notYet();
}

/** The user's workspaces, by name, with their role. */
export function workspacesOf(_db: Kysely<Database>, _userId: string): Promise<MemberWorkspace[]> {
  return notYet();
}

/** Every workspace, by name. */
export function allWorkspaces(_db: Kysely<Database>): Promise<Workspace[]> {
  return notYet();
}

/** Creates the workspace with its owner, in one transaction. */
export function createOwnedWorkspace(
  _db: Kysely<Database>,
  _input: WorkspaceInput,
  _ownerId: string,
): Promise<MemberWorkspace> {
  return notYet();
}

/** Makes every instance administrator owner of the workspaces (all of them by default) they are not a member of. */
export function makeAdminsOwners(_db: Kysely<Database>, _workspaceIds?: readonly string[]): Promise<void> {
  return notYet();
}
