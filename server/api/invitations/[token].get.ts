import { getRequestURL } from 'h3';

import { problemOf } from '../../../shared/contracts/errors';
import { getInvitation } from '../../../shared/contracts/invitations';
import { findInvitation } from '../../repositories/invitations';
import { defineContractHandler } from '../../utils/contract-handler';
import { useDatabase } from '../../utils/database';

/** What an invitation link offers; nothing about whether its email has an account. */
export default defineContractHandler(getInvitation, async ({ params: { token } }, event) => {
  const invitation = await findInvitation(await useDatabase(), token);
  if (!invitation) {
    return {
      status: 404,
      body: problemOf('invitation_not_found', {
        detail: 'This invitation does not exist or is no longer valid.',
        instance: getRequestURL(event).pathname,
      }),
    };
  }
  const { workspace, role, email, invitedBy, expiresAt } = invitation;
  return {
    status: 200,
    body: { workspace: workspace.name, role, email, invitedBy, expiresAt: expiresAt.toISOString() },
  };
});
