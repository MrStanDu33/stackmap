import type { WorkspaceRole } from '../../shared/contracts/contract';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

/*
 * Invitations to a workspace. The link's token is returned once, when it is created; only its SHA-256 hash is stored,
 * so the database alone cannot be used to join.
 */

export interface Invitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: string | null;
  expiresAt: Date;
}

/** An invitation found by its link, with its workspace. */
export interface LinkedInvitation extends Invitation {
  workspace: { name: string; slug: string };
}

const notYet = (): never => {
  throw new Error('Not implemented');
};

/** Creates an invitation, replacing a pending one for the same email and workspace; answers it and its token. */
export function createInvitation(
  _db: Kysely<Database>,
  _input: { workspaceId: string; email: string; role: WorkspaceRole; invitedById: string },
  _now?: Date,
): Promise<{ invitation: Invitation; token: string }> {
  return notYet();
}

/** The invitation of a link's token, or undefined when there is none or it has expired. */
export function findInvitation(
  _db: Kysely<Database>,
  _token: string,
  _now?: Date,
): Promise<LinkedInvitation | undefined> {
  return notYet();
}

/** Uses the invitation up and adds the user with its role, unless already a member; false when it was gone. */
export function useInvitation(_db: Kysely<Database>, _invitationId: string, _userId: string): Promise<boolean> {
  return notYet();
}

/** Deletes a workspace's invitation; false when it has none with this id. */
export function revokeInvitation(_db: Kysely<Database>, _workspaceId: string, _invitationId: string): Promise<boolean> {
  return notYet();
}

/** A workspace's invitations that have not expired, by email. */
export function pendingInvitations(_db: Kysely<Database>, _workspaceId: string, _now?: Date): Promise<Invitation[]> {
  return notYet();
}
