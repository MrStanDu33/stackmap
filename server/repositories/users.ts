import type { UserAccount } from '../../shared/contracts/users';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

/** Why the administrator's change was refused; `last_owner` names the workspaces it would leave without an owner. */
export type UserRefusal
  = | { code: 'user_not_found' | 'cannot_demote_self' | 'last_admin' | 'cannot_remove_self' }
    | { code: 'last_owner'; workspaces: string[] };

/** Every account by name. Instance-level: accounts belong to no workspace. */
export function listUsers(_db: Kysely<Database>): Promise<UserAccount[]> {
  throw new Error('Not implemented');
}

/** Sets the instance role, unless the actor demotes themselves or the instance would have no administrator left. */
export function setInstanceRole(
  _db: Kysely<Database>,
  _userId: string,
  _role: UserAccount['role'],
  _options: { actorId: string },
): Promise<UserAccount | UserRefusal> {
  throw new Error('Not implemented');
}

/** Removes an account, unless it is the actor's or the only owner of a workspace. */
export function removeAccount(
  _db: Kysely<Database>,
  _userId: string,
  _options: { actorId: string },
): Promise<UserAccount | UserRefusal> {
  throw new Error('Not implemented');
}
