import { randomBytes } from 'node:crypto';

import { createAuth } from '../auth/auth';
import { findUserByEmail, setPasswordMark } from '../repositories/users';
import { authUrl } from '../utils/auth';

import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

export interface CommandIo {
  db: Kysely<Database>;
  out: (line: string) => void;
  err: (line: string) => void;
}

const USAGE = [
  'Usage: reset-password <email>',
  '',
  'Gives the account a new temporary password, printed once, and signs it out everywhere. It must choose its own',
  'password when it next signs in. Run it in the container: docker compose exec stackmap reset-password <email>',
];

/**
 * `reset-password <email>`, for an administrator locked out: answers the exit code (0 done, 1 no such account,
 * 2 wrong usage). Better Auth hashes and writes the password and ends the sessions, through its internal adapter.
 */
export async function resetPassword(args: readonly string[], { db, out, err }: CommandIo): Promise<number> {
  if (args[0] === '--help') {
    USAGE.forEach(out);
    return 0;
  }
  const email = args[0]?.trim();
  if (args.length !== 1 || !email) {
    USAGE.forEach(err);
    return 2;
  }
  const user = await findUserByEmail(db, email);
  if (!user) {
    err('No account with this email.');
    return 1;
  }
  // 15 random bytes: 20 base64url characters, nothing to type and nothing a shell would mangle.
  const password = randomBytes(15).toString('base64url');
  // Only the internal adapter is used, which signs nothing: a throwaway secret is enough.
  const auth = createAuth(db, { secret: randomBytes(32).toString('base64url'), baseURL: authUrl() });
  const context = await auth.$context;
  await context.internalAdapter.updatePassword(user.id, await context.password.hash(password));
  await setPasswordMark(db, user.id, true);
  await context.internalAdapter.deleteUserSessions(user.id);
  out(`Temporary password for ${user.email}: ${password}`);
  out('Send it to them privately: they choose their own when they next sign in.');
  return 0;
}
