import { APIError } from 'better-auth/api';
import { getRequestURL } from 'h3';

import { signIn } from '../../shared/contracts/auth';
import { problemOf } from '../../shared/contracts/errors';
import { forwardCookies, throttle } from '../auth/requests';
import { useAuth } from '../utils/auth';
import { defineContractHandler } from '../utils/contract-handler';
import { useDatabase } from '../utils/database';

/** Signs in with an email and password; a wrong email and a wrong password get the same answer. */
export default defineContractHandler(signIn, async ({ body }, event) => {
  const throttled = await throttle(await useDatabase(), event, 'sign-in');
  if (throttled) {
    return throttled;
  }
  const auth = await useAuth();
  try {
    const { headers, response } = await auth.api.signInEmail({
      body: { email: body.email, password: body.password },
      headers: event.headers,
      returnHeaders: true,
    });
    forwardCookies(event, headers);
    const { id, name, email, role } = response.user as typeof response.user & { role?: string | null };
    return { status: 200, body: { user: { id, name, email, role: role === 'admin' ? 'admin' : 'user' } } };
  } catch (error) {
    // Whatever Better Auth refuses (a wrong password, a banned account…) answers the same: nothing tells them apart.
    if (error instanceof APIError && error.statusCode < 500 && error.statusCode !== 429) {
      return {
        status: 401,
        body: problemOf('invalid_credentials', {
          detail: 'Email or password is incorrect.',
          instance: getRequestURL(event).pathname,
        }),
      };
    }
    throw error;
  }
});
