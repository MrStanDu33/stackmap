import { inTransaction } from './entity-repository';
import { MAX_USERS } from '../../shared/contracts/users';
import { toTimestamp } from '../database/serialize';

import type { UserAccount } from '../../shared/contracts/users';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

/** Why the administrator's change was refused; `last_owner` names the workspaces it would leave without an owner. */
export type UserRefusal
  = | { code: 'user_not_found' | 'cannot_demote_self' | 'last_admin' | 'cannot_remove_self' }
    | { code: 'last_owner'; workspaces: string[] };

/** The app setting whose row every account change locks, so that two of them see each other's outcome. */
const USERS_LOCK = 'users.lock';

const selectUsers = (db: Kysely<Database>) =>
  db.selectFrom('user').select(['id', 'name', 'email', 'role', 'createdAt']);

type UserRow = Pick<Database['user'], 'id' | 'name' | 'email' | 'role' | 'createdAt'>;

const toUser = (row: UserRow): UserAccount => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role === 'admin' ? 'admin' : 'user',
  createdAt: new Date(row.createdAt).toISOString(),
});

/** Every account by name (at most MAX_USERS). Instance-level: accounts belong to no workspace. */
export async function listUsers(db: Kysely<Database>): Promise<UserAccount[]> {
  const rows = await selectUsers(db).orderBy('name').orderBy('email').limit(MAX_USERS).execute();
  return rows.map(toUser);
}

/** One account, or undefined. */
export async function findUser(db: Kysely<Database>, userId: string): Promise<UserAccount | undefined> {
  const row = await selectUsers(db).where('id', '=', userId).executeTakeFirst();
  return row && toUser(row);
}

/** The account with this email (stored in lower case), or undefined. */
export async function findUserByEmail(db: Kysely<Database>, email: string): Promise<UserAccount | undefined> {
  const row = await selectUsers(db).where('email', '=', email.trim().toLowerCase()).executeTakeFirst();
  return row && toUser(row);
}

/**
 * Runs an account change with the users lock held: an upsert takes the lock row, so a second change waits for the
 * first to commit and then counts what it left (Postgres; SQLite runs one write transaction at a time anyway).
 */
function withUsersLock<T>(
  db: Kysely<Database>,
  userId: string,
  work: (trx: Kysely<Database>, user: UserAccount) => Promise<T | UserRefusal>,
): Promise<T | UserRefusal> {
  return inTransaction(db, async (trx) => {
    const now = toTimestamp(new Date());
    await trx.insertInto('appSetting').values({ key: USERS_LOCK, value: JSON.stringify(now), updatedAt: now })
      .onConflict((conflict) => conflict.column('key').doUpdateSet({ updatedAt: now }))
      .execute();
    const user = await findUser(trx, userId);
    return user ? work(trx, user) : { code: 'user_not_found' as const };
  });
}

const adminCount = async (trx: Kysely<Database>) => {
  const row = await trx.selectFrom('user').select((count) => count.fn.countAll<number | string>().as('n'))
    .where('role', '=', 'admin').executeTakeFirstOrThrow();
  return Number(row.n);
};

/** Sets the instance role, unless the actor demotes themselves or the instance would have no administrator left. */
export function setInstanceRole(
  db: Kysely<Database>,
  userId: string,
  role: UserAccount['role'],
  { actorId }: { actorId: string },
): Promise<UserAccount | UserRefusal> {
  return withUsersLock(db, userId, async (trx, user) => {
    if (role === 'user' && user.role === 'admin') {
      if (userId === actorId) {
        return { code: 'cannot_demote_self' };
      }
      if (await adminCount(trx) <= 1) {
        return { code: 'last_admin' };
      }
    }
    await trx.updateTable('user').set({ role }).where('id', '=', userId).execute();
    return { ...user, role };
  });
}

/**
 * Removes an account, unless it is the actor's or the only owner of a workspace. Its sessions, credentials and
 * memberships go with it (foreign keys), and its invitations lose their inviter.
 */
export function removeAccount(
  db: Kysely<Database>,
  userId: string,
  { actorId }: { actorId: string },
): Promise<UserAccount | UserRefusal> {
  return withUsersLock(db, userId, async (trx, user) => {
    if (userId === actorId) {
      return { code: 'cannot_remove_self' };
    }
    const owned = trx.selectFrom('member').select('workspaceId').where('userId', '=', userId).where('role', '=', 'owner');
    // Locks the workspaces it owns, as member changes do (members.ts), so that a demotion there waits for this.
    await trx.updateTable('workspace').set((update) => ({ id: update.ref('id') })).where('id', 'in', owned).execute();
    const soleOwned = await trx.selectFrom('workspace').select('name')
      .where('id', 'in', owned)
      .where((where) => where.not(where.exists(where.selectFrom('member').select('member.userId')
        .whereRef('member.workspaceId', '=', 'workspace.id')
        .where('member.role', '=', 'owner')
        .where('member.userId', '!=', userId))))
      .orderBy('name')
      .execute();
    if (soleOwned.length > 0) {
      return { code: 'last_owner', workspaces: soleOwned.map(({ name }) => name) };
    }
    await trx.deleteFrom('user').where('id', '=', userId).execute();
    return user;
  });
}
