import { getRequestURL } from 'h3';

import { problemOf } from '../../../shared/contracts/errors';
import { createUser } from '../../../shared/contracts/users';
import { findUserByEmail, setPasswordMark } from '../../repositories/users';
import { useAuth } from '../../utils/auth';
import { defineContractHandler } from '../../utils/contract-handler';
import { useDatabase } from '../../utils/database';

/**
 * Creates a plain account with the temporary password the administrator chose, through Better Auth's admin API,
 * which hashes it and leaves the administrator's own session alone.
 */
export default defineContractHandler(createUser, async ({ body }, event) => {
  const db = await useDatabase();
  const taken = {
    status: 409 as const,
    body: problemOf('email_taken', { detail: 'An account already uses this email.', instance: getRequestURL(event).pathname }),
  };
  const auth = await useAuth();
  let user;
  try {
    ({ user } = await auth.api.createUser({
      body: { name: body.name, email: body.email, password: body.password, role: 'user', data: { emailVerified: true } },
      headers: event.headers,
    }));
  } catch (error) {
    // Better Auth's own check, or the unique email when two creations race: either way, the email is now taken.
    // Only the administrator sees this answer: it reveals nothing to anyone else.
    if (await findUserByEmail(db, body.email)) {
      return taken;
    }
    throw error;
  }
  // A temporary password: the person replaces it before anything else (4d).
  await setPasswordMark(db, user.id, true);
  return {
    status: 201,
    body: { id: user.id, name: user.name, email: user.email, role: 'user', createdAt: new Date(user.createdAt).toISOString() },
  };
});
