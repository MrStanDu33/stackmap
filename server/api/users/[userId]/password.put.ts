import { getRequestURL } from 'h3';

import { problemOf } from '../../../../shared/contracts/errors';
import { setUserPassword } from '../../../../shared/contracts/users';
import { findUser } from '../../../repositories/users';
import { useAuth } from '../../../utils/auth';
import { defineContractHandler } from '../../../utils/contract-handler';
import { useDatabase } from '../../../utils/database';

/**
 * Gives another account a new temporary password and signs it out everywhere, so whoever held the old one is out.
 * The caller's own password is changed elsewhere (4d).
 */
export default defineContractHandler(setUserPassword, async ({ params: { userId }, body, session }, event) => {
  const instance = getRequestURL(event).pathname;
  if (userId === session.user.id) {
    return {
      status: 409,
      body: problemOf('cannot_reset_self', { detail: 'Administrators cannot give themselves a temporary password.', instance }),
    };
  }
  if (!await findUser(await useDatabase(), userId)) {
    return { status: 404, body: problemOf('user_not_found', { detail: 'No account with this id.', instance }) };
  }
  const auth = await useAuth();
  await auth.api.setUserPassword({ body: { userId, newPassword: body.password }, headers: event.headers });
  await auth.api.revokeUserSessions({ body: { userId }, headers: event.headers });
  return { status: 204, body: null };
});
