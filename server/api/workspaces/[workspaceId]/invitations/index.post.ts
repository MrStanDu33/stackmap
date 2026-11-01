import { getRequestURL } from 'h3';

import { problemOf } from '../../../../../shared/contracts/errors';
import { createInvitation } from '../../../../../shared/contracts/invitations';
import { canManage } from '../../../../domain/member-rules';
import { createInvitation as invite } from '../../../../repositories/invitations';
import { listMembers } from '../../../../repositories/members';
import { defineContractHandler } from '../../../../utils/contract-handler';
import { useDatabase } from '../../../../utils/database';

/** Creates an invitation link, shown once, for a role the caller may grant. */
export default defineContractHandler(createInvitation, async ({ body: { email, role }, session, workspace }, event) => {
  const db = await useDatabase();
  const instance = getRequestURL(event).pathname;
  if (!canManage(workspace.role, null, role)) {
    return { status: 403, body: problemOf('forbidden', { detail: `A ${workspace.role} cannot invite a ${role}.`, instance }) };
  }
  const lowered = email.trim().toLowerCase();
  if ((await listMembers(db, workspace.id)).some((member) => member.email === lowered)) {
    return { status: 409, body: problemOf('already_member', { detail: 'This email belongs to a member already.', instance }) };
  }
  const { invitation, token } = await invite(db, {
    workspaceId: workspace.id, email: lowered, role, invitedById: session.user.id,
  });
  return {
    status: 201,
    body: {
      invitation: {
        id: invitation.id, email: invitation.email, role: invitation.role, invitedBy: invitation.invitedBy,
        expiresAt: invitation.expiresAt.toISOString(),
      },
      url: `/invite/${token}`,
    },
  };
});
