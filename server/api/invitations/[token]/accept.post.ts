import { getRequestURL } from 'h3';

import { problemOf } from '../../../../shared/contracts/errors';
import { acceptInvitation } from '../../../../shared/contracts/invitations';
import { throttle } from '../../../auth/requests';
import { findInvitation, useInvitation } from '../../../repositories/invitations';
import { defineContractHandler } from '../../../utils/contract-handler';
import { useDatabase } from '../../../utils/database';

/** Joins the workspace with the invitation's role, as the account it was sent to. */
export default defineContractHandler(acceptInvitation, async ({ params: { token }, session }, event) => {
  const db = await useDatabase();
  const throttled = await throttle(db, event, 'invitation');
  if (throttled) {
    return throttled;
  }
  const instance = getRequestURL(event).pathname;
  const notFound = {
    status: 404 as const,
    body: problemOf('invitation_not_found', { detail: 'This invitation does not exist or is no longer valid.', instance }),
  };
  const invitation = await findInvitation(db, token);
  if (!invitation) {
    return notFound;
  }
  if (invitation.email !== session.user.email.trim().toLowerCase()) {
    return {
      status: 403,
      body: problemOf('invitation_email_mismatch', { detail: 'This invitation is for another email.', instance }),
    };
  }
  if (!await useInvitation(db, invitation.id, session.user.id)) {
    return notFound;
  }
  return { status: 200, body: { slug: invitation.workspace.slug } };
});
