import { useAuth } from './auth';
import { useDatabase } from './database';
import { forwardCookies } from '../auth/requests';
import { preferencesOf } from '../repositories/preferences';

import type { Session } from '../../shared/contracts/auth';
import type { H3Event } from 'h3';

/** Reads who is signed in from a request: by default the session cookie, through Better Auth. */
export type SessionResolver = (event: H3Event) => Promise<Session | null>;

/** Better Auth's user, with what the app adds: the mark of a temporary password (0/1 on SQLite) and the preferences. */
export async function sessionOf(user: {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  mustChangePassword?: boolean | number | null;
}): Promise<Session> {
  const { id, name, email, role, mustChangePassword } = user;
  return {
    user: {
      id,
      name,
      email,
      role: role === 'admin' ? 'admin' : 'user',
      mustChangePassword: Boolean(mustChangePassword),
      preferences: await preferencesOf(await useDatabase(), id),
    },
  };
}

/** The session of the request's cookie, or null when it has none, or an expired or invalid one. */
const fromCookie: SessionResolver = async (event) => {
  const auth = await useAuth();
  // Better Auth renews a session used a day after its last renewal, and clears an expired cookie: both go to the
  // browser.
  const { headers, response: found } = await auth.api.getSession({ headers: event.headers, returnHeaders: true });
  forwardCookies(event, headers);
  if (!found) {
    return null;
  }
  return sessionOf(found.user);
};

let resolver: SessionResolver = fromCookie;

/** For tests: who requests are made as; the cookie resolver again when called without one. */
export function setSessionResolver(next: SessionResolver = fromCookie): void {
  resolver = next;
}

export const getRequestSession = (event: H3Event): Promise<Session | null> => resolver(event);
