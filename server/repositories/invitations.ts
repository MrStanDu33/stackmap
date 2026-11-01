import { createHash, randomBytes } from 'node:crypto';

import { inTransaction } from './entity-repository';
import { INVITATION_DAYS } from '../../shared/contracts/invitations';
import { newId } from '../database/ids';
import { fromTimestamp, toTimestamp } from '../database/serialize';
import { canManage } from '../domain/member-rules';

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

const DAY = 24 * 60 * 60 * 1000;

const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');

/** An invitation's columns, with its inviter's name and current role in the workspace. */
const selectInvitations = (db: Kysely<Database>) => db.selectFrom('invitation')
  .leftJoin('user', 'user.id', 'invitation.invitedById')
  .leftJoin('member as inviter', (join) => join
    .onRef('inviter.workspaceId', '=', 'invitation.workspaceId')
    .onRef('inviter.userId', '=', 'invitation.invitedById'))
  .select([
    'invitation.id', 'invitation.workspaceId', 'invitation.email', 'invitation.role', 'invitation.expiresAt',
    'user.name as invitedBy', 'inviter.role as inviterRole',
  ]);

type InvitationRow = Omit<Invitation, 'expiresAt'> & { expiresAt: string; inviterRole: WorkspaceRole | null };

/**
 * Whether the invitation still stands: its inviter must still be allowed to grant its role. Demoted, gone from the
 * workspace or deleted, they no longer vouch for it.
 */
const stands = ({ inviterRole, role }: InvitationRow) => inviterRole !== null && canManage(inviterRole, null, role);

const toInvitation = ({ expiresAt, inviterRole: _inviterRole, ...row }: InvitationRow): Invitation =>
  ({ ...row, expiresAt: fromTimestamp(expiresAt, 'invitation.expiresAt') });

/** Creates an invitation, replacing a pending one for the same email and workspace; answers it and its token. */
export function createInvitation(
  db: Kysely<Database>,
  { workspaceId, email, role, invitedById }: {
    workspaceId: string;
    email: string;
    role: WorkspaceRole;
    invitedById: string;
  },
  now = new Date(),
): Promise<{ invitation: Invitation; token: string }> {
  const token = randomBytes(32).toString('base64url');
  const id = newId();
  const lowered = email.trim().toLowerCase();
  return inTransaction(db, async (trx) => {
    await trx.deleteFrom('invitation').where('workspaceId', '=', workspaceId).where('email', '=', lowered).execute();
    await trx.insertInto('invitation').values({
      id, workspaceId, email: lowered, role, tokenHash: hashOf(token), invitedById,
      createdAt: toTimestamp(now), expiresAt: toTimestamp(new Date(now.getTime() + INVITATION_DAYS * DAY)),
    }).execute();
    const row = await selectInvitations(trx).where('invitation.id', '=', id).executeTakeFirstOrThrow();
    return { invitation: toInvitation(row), token };
  });
}

/** The invitation of a link's token, or undefined when there is none, it has expired or no longer stands. */
export async function findInvitation(
  db: Kysely<Database>,
  token: string,
  now = new Date(),
): Promise<LinkedInvitation | undefined> {
  const row = await selectInvitations(db)
    .innerJoin('workspace', 'workspace.id', 'invitation.workspaceId')
    .select(['workspace.name as workspaceName', 'workspace.slug as workspaceSlug'])
    .where('invitation.tokenHash', '=', hashOf(token))
    .where('invitation.expiresAt', '>', toTimestamp(now))
    .executeTakeFirst();
  if (!row || !stands(row)) {
    return undefined;
  }
  const { workspaceName, workspaceSlug, ...invitation } = row;
  return { ...toInvitation(invitation), workspace: { name: workspaceName, slug: workspaceSlug } };
}

/** Uses the invitation up and adds the user with its role, unless already a member; false when it was gone. */
export function useInvitation(db: Kysely<Database>, invitationId: string, userId: string): Promise<boolean> {
  return inTransaction(db, async (trx) => {
    // Deleted first: of two acceptances at once, only the one that deleted it goes on.
    const used = await trx.deleteFrom('invitation').where('id', '=', invitationId)
      .returning(['workspaceId', 'role']).executeTakeFirst();
    if (!used) {
      return false;
    }
    await trx.insertInto('member')
      .values({ workspaceId: used.workspaceId, userId, role: used.role, createdAt: toTimestamp(new Date()) })
      .onConflict((conflict) => conflict.columns(['workspaceId', 'userId']).doNothing())
      .execute();
    return true;
  });
}

/** Deletes a workspace's invitation; false when it has none with this id. */
export async function revokeInvitation(
  db: Kysely<Database>,
  workspaceId: string,
  invitationId: string,
): Promise<boolean> {
  const { numDeletedRows } = await db.deleteFrom('invitation')
    .where('id', '=', invitationId).where('workspaceId', '=', workspaceId).executeTakeFirstOrThrow();
  return numDeletedRows > 0n;
}

/** A workspace's invitations that have not expired and still stand, by email. */
export async function pendingInvitations(
  db: Kysely<Database>,
  workspaceId: string,
  now = new Date(),
): Promise<Invitation[]> {
  const rows = await selectInvitations(db)
    .where('invitation.workspaceId', '=', workspaceId)
    .where('invitation.expiresAt', '>', toTimestamp(now))
    .orderBy('invitation.email')
    .execute();
  return rows.filter(stands).map(toInvitation);
}
