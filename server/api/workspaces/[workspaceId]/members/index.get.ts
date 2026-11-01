import { listMembers } from '../../../../../shared/contracts/members';
import { pendingInvitations } from '../../../../repositories/invitations';
import { listMembers as membersOf } from '../../../../repositories/members';
import { defineContractHandler } from '../../../../utils/contract-handler';
import { useDatabase } from '../../../../utils/database';

/** The members, and for admins and owners the pending invitations. */
export default defineContractHandler(listMembers, async ({ workspace }) => {
  const db = await useDatabase();
  const members = (await membersOf(db, workspace.id))
    .map(({ joinedAt, ...member }) => ({ ...member, joinedAt: joinedAt.toISOString() }));
  if (workspace.role !== 'admin' && workspace.role !== 'owner') {
    return { status: 200, body: { members } };
  }
  const invitations = (await pendingInvitations(db, workspace.id))
    .map(({ id, email, role, invitedBy, expiresAt }) => ({
      id, email, role, invitedBy, expiresAt: expiresAt.toISOString(),
    }));
  return { status: 200, body: { members, invitations } };
});
