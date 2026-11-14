import { APIError } from 'better-auth/api';
import { getRequestURL } from 'h3';

import { changePassword } from '../../../shared/contracts/account';
import { problemOf } from '../../../shared/contracts/errors';
import { forwardCookies, throttle } from '../../auth/requests';
import { setPasswordMark } from '../../repositories/users';
import { useAuth } from '../../utils/auth';
import { defineContractHandler } from '../../utils/contract-handler';
import { useDatabase } from '../../utils/database';

/**
 * Changes the signed-in account's password through Better Auth, which signs out its other sessions and renews this
 * one's cookie; then clears a temporary password's mark.
 */
export default defineContractHandler(changePassword, async ({ body, session }, event) => {
  const db = await useDatabase();
  const throttled = await throttle(db, event, 'password');
  if (throttled) {
    return throttled;
  }
  const auth = await useAuth();
  try {
    const { headers } = await auth.api.changePassword({
      body: { currentPassword: body.currentPassword, newPassword: body.newPassword, revokeOtherSessions: true },
      headers: event.headers,
      returnHeaders: true,
    });
    forwardCookies(event, headers);
  } catch (error) {
    if (error instanceof APIError && error.statusCode === 400) {
      return {
        status: 400,
        body: problemOf('wrong_password', { detail: 'The current password is incorrect.', instance: getRequestURL(event).pathname }),
      };
    }
    throw error;
  }
  await setPasswordMark(db, session.user.id, false);
  return { status: 204, body: null };
});
