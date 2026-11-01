import { isUniqueViolation } from '../database/errors';

import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

/** The app setting the first administrator's creation claims, so two concurrent setups cannot both go through. */
const SETUP_CLAIM = 'setup.claimed';

/** Whether any account exists. Instance-level: accounts belong to no workspace. */
export async function hasAccounts(db: Kysely<Database>): Promise<boolean> {
  const row = await db.selectFrom('user').select('id').limit(1).executeTakeFirst();
  return row !== undefined;
}

/** Claims the setup once; false when another request claimed it first. */
export async function claimSetup(db: Kysely<Database>, at: Date): Promise<boolean> {
  try {
    await db.insertInto('appSetting')
      .values({ key: SETUP_CLAIM, value: JSON.stringify(at.toISOString()), updatedAt: at.toISOString() })
      .execute();
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return false;
    }
    throw error;
  }
}

/** At start: a claim with no account was left by a crash during setup, and would block it for good. */
export async function releaseUnusedSetupClaim(db: Kysely<Database>): Promise<void> {
  if (!await hasAccounts(db)) {
    await releaseSetup(db);
  }
}

/** Removes an account Better Auth created before failing, so setup can be tried again (its sessions go with it). */
export async function removeAccount(db: Kysely<Database>, email: string): Promise<void> {
  await db.deleteFrom('user').where('email', '=', email.trim().toLowerCase()).execute();
}

/** Gives the claim back when the administrator could not be created, so setup can be tried again. */
export async function releaseSetup(db: Kysely<Database>): Promise<void> {
  await db.deleteFrom('appSetting').where('key', '=', SETUP_CLAIM).execute();
}

/**
 * Counts an attempt for a key (such as `sign-in:<address>`) in Better Auth's rate-limit table: allowed while the
 * window holds fewer than `max`, with the seconds to wait otherwise. One atomic upsert, so concurrent attempts count.
 */
export async function hitRateLimit(
  db: Kysely<Database>,
  key: string,
  { windowMs, max, now }: { windowMs: number; max: number; now: number },
): Promise<{ allowed: boolean; retryAfter: number }> {
  const since = now - windowMs;
  // Counts whose window has passed are no use: without this, every address ever seen would stay.
  await db.deleteFrom('rateLimit').where('lastRequest', '<', since).execute();
  const row = await db.insertInto('rateLimit')
    .values({ id: key, key, count: 1, lastRequest: now })
    .onConflict((conflict) => conflict.column('key').doUpdateSet((eb) => ({
      count: eb.case().when('rateLimit.lastRequest', '<', since).then(1).else(eb('rateLimit.count', '+', 1)).end(),
      lastRequest: eb.case().when('rateLimit.lastRequest', '<', since).then(now).else(eb.ref('rateLimit.lastRequest')).end(),
    })))
    .returning(['count', 'lastRequest'])
    .executeTakeFirstOrThrow();
  const { count } = row;
  return {
    allowed: count <= max,
    retryAfter: Math.max(1, Math.ceil((Number(row.lastRequest) + windowMs - now) / 1000)),
  };
}
