import { APIError } from 'better-auth/api';
import { hashPassword } from 'better-auth/crypto';
import { getRequestURL } from 'h3';

import { problemOf } from '../../../../shared/contracts/errors';
import { registerWithInvitation } from '../../../../shared/contracts/invitations';
import { throttle } from '../../../auth/requests';
import { accountExists, removeSession } from '../../../repositories/accounts';
import { findInvitation } from '../../../repositories/invitations';
import { useAuth } from '../../../utils/auth';
import { defineContractHandler } from '../../../utils/contract-handler';
import { useDatabase } from '../../../utils/database';

const DONE = { status: 202 as const, body: null };

/**
 * Creates an account with the invited email when it has none. The answer is the same either way, and takes about as
 * long (the password is hashed either way): it never tells whether the email had an account. The person then signs
 * in and accepts.
 */
export default defineContractHandler(registerWithInvitation, async ({ params: { token }, body }, event) => {
  const db = await useDatabase();
  const throttled = await throttle(db, event, 'invitation');
  if (throttled) {
    return throttled;
  }
  const invitation = await findInvitation(db, token);
  if (!invitation) {
    return {
      status: 404,
      body: problemOf('invitation_not_found', {
        detail: 'This invitation does not exist or is no longer valid.',
        instance: getRequestURL(event).pathname,
      }),
    };
  }
  if (await accountExists(db, invitation.email)) {
    await hashPassword(body.password);
    return DONE;
  }
  try {
    const { token: session } = await (await useAuth()).api.signUpEmail({
      body: { name: body.name.trim(), email: invitation.email, password: body.password },
    });
    // Better Auth signs in on sign-up; no one asked for this session, and no cookie carries it.
    if (session) {
      await removeSession(db, session);
    }
  } catch (error) {
    // The same answer when another request created it first.
    if (!(error instanceof APIError && error.statusCode < 500)) {
      throw error;
    }
  }
  return DONE;
});
