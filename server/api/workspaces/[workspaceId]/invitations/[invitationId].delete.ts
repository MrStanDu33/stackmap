import { getRequestURL } from 'h3';

import { problemOf } from '../../../../../shared/contracts/errors';
import { revokeInvitation } from '../../../../../shared/contracts/invitations';
import { canManage } from '../../../../domain/member-rules';
import { pendingInvitations, revokeInvitation as revoke } from '../../../../repositories/invitations';
import { defineContractHandler } from '../../../../utils/contract-handler';
import { useDatabase } from '../../../../utils/database';

/** Revokes a pending invitation of the workspace, for a role the caller could grant: its link stops working. */
export default defineContractHandler(revokeInvitation, async ({ params: { invitationId }, workspace }, event) => {
  const db = await useDatabase();
  const instance = getRequestURL(event).pathname;
  const invitation = (await pendingInvitations(db, workspace.id)).find(({ id }) => id === invitationId);
  if (invitation && !canManage(workspace.role, null, invitation.role)) {
    return { status: 403, body: problemOf('forbidden', { detail: `A ${workspace.role} cannot revoke an invitation as ${invitation.role}.`, instance }) };
  }
  if (await revoke(db, workspace.id, invitationId)) {
    return { status: 204, body: null };
  }
  return { status: 404, body: problemOf('invitation_not_found', { detail: 'The workspace has no such invitation.', instance }) };
});
