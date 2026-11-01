import { getRequestURL } from 'h3';

import { problemOf } from '../../../../../shared/contracts/errors';
import { revokeInvitation } from '../../../../../shared/contracts/invitations';
import { revokeInvitation as revoke } from '../../../../repositories/invitations';
import { defineContractHandler } from '../../../../utils/contract-handler';
import { useDatabase } from '../../../../utils/database';

/** Revokes a pending invitation of the workspace: its link stops working. */
export default defineContractHandler(revokeInvitation, async ({ params: { invitationId }, workspace }, event) => {
  if (await revoke(await useDatabase(), workspace.id, invitationId)) {
    return { status: 204, body: null };
  }
  return {
    status: 404,
    body: problemOf('invitation_not_found', {
      detail: 'The workspace has no such invitation.',
      instance: getRequestURL(event).pathname,
    }),
  };
});
