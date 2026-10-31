import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins/admin';
import { PostgresAdapter } from 'kysely';

import { clientIp } from './requests';
import { MAX_PASSWORD, MIN_PASSWORD } from '../../shared/contracts/auth';
import { newId } from '../database/ids';
import { hasAccounts } from '../repositories/accounts';

import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

export interface AuthOptions {
  secret: string;
  /** `BETTER_AUTH_URL`: where the instance is reached. Over HTTPS, cookies are Secure. */
  baseURL: string;
}

/**
 * Better Auth on the app's database: email and password, the instance role (admin plugin), our ids. Only its server
 * API is used, from the account routes: its own router is not mounted, so its rate limiter is ours instead
 * (server/repositories/accounts.ts).
 */
export function createAuth(db: Kysely<Database>, { secret, baseURL }: AuthOptions) {
  return betterAuth({
    database: { db, type: db.getExecutor().adapter instanceof PostgresAdapter ? 'postgres' : 'sqlite' },
    secret,
    baseURL,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD,
      maxPasswordLength: MAX_PASSWORD,
      autoSignIn: true,
    },
    plugins: [admin({ defaultRole: 'user', adminRoles: ['admin'] })],
    databaseHooks: {
      // The first account is the instance administrator from its creation: no second step that could fail.
      user: { create: { before: async (user) => ({ data: { ...user, role: await hasAccounts(db) ? 'user' : 'admin' } }) } },
      // The address the attempts are counted under, not Better Auth's (the first X-Forwarded-For, which anyone sets).
      session: {
        create: {
          before: (session, context) => Promise.resolve({
            data: { ...session, ipAddress: context?.headers ? clientIp(context.headers) ?? null : null },
          }),
        },
      },
    },
    rateLimit: { enabled: false },
    telemetry: { enabled: false },
    advanced: {
      database: { generateId: () => newId() },
      useSecureCookies: baseURL.startsWith('https://'),
      defaultCookieAttributes: { sameSite: 'lax', httpOnly: true },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
