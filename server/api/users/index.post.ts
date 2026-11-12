import { getRequestURL } from 'h3';

import { problemOf } from '../../../shared/contracts/errors';
import { createUser } from '../../../shared/contracts/users';
import { findUserByEmail } from '../../repositories/users';
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
  // Only the administrator sees this answer: it reveals nothing to anyone else.
  if (await findUserByEmail(db, body.email)) {
    return taken;
  }
  const auth = await useAuth();
  const { user } = await auth.api.createUser({
    body: { name: body.name.trim(), email: body.email, password: body.password, role: 'user', data: { emailVerified: true } },
    headers: event.headers,
  });
  return {
    status: 201,
    body: { id: user.id, name: user.name, email: user.email, role: 'user', createdAt: new Date(user.createdAt).toISOString() },
  };
});
