import { inTransaction } from './entity-repository';
import { createWorkspace, toWorkspace, WORKSPACE_COLUMNS } from './workspaces';
import { MAX_WORKSPACES } from '../../shared/contracts/workspaces';
import { fromTimestamp, toTimestamp } from '../database/serialize';

import type { WorkspaceRole } from '../../shared/contracts/contract';
import type { Workspace, WorkspaceInput } from '../../shared/workspace';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

/*
 * Who belongs to which workspace. A workspace's data is reachable only through a membership (or, with
 * INSTANCE_ADMIN_ALL_WORKSPACES, as the instance administrator).
 */

export type MemberWorkspace = Workspace & { role: WorkspaceRole };

export async function addMember(
  db: Kysely<Database>,
  { workspaceId, userId, role }: { workspaceId: string; userId: string; role: WorkspaceRole },
): Promise<void> {
  await db.insertInto('member').values({ workspaceId, userId, role, createdAt: toTimestamp(new Date()) }).execute();
}

/** The user's role in the workspace, or undefined when they are not a member (or it does not exist). */
export async function roleIn(
  db: Kysely<Database>,
  userId: string,
  workspaceId: string,
): Promise<WorkspaceRole | undefined> {
  const row = await db.selectFrom('member').select('role')
    .where('userId', '=', userId).where('workspaceId', '=', workspaceId).executeTakeFirst();
  return row?.role;
}

// shortcut: no paging, at most MAX_WORKSPACES; page when a user can belong to more.
/** The user's workspaces, by name, with their role. */
export async function workspacesOf(db: Kysely<Database>, userId: string): Promise<MemberWorkspace[]> {
  const rows = await db.selectFrom('workspace')
    .innerJoin('member', 'member.workspaceId', 'workspace.id')
    .select([...WORKSPACE_COLUMNS.map((column) => `workspace.${column}` as const), 'member.role'])
    .where('member.userId', '=', userId)
    .orderBy('workspace.name').orderBy('workspace.slug')
    .limit(MAX_WORKSPACES)
    .execute();
  return rows.map(({ role, ...row }) => ({ ...toWorkspace(row), role }));
}

/** Every workspace, by name. */
export async function allWorkspaces(db: Kysely<Database>): Promise<Workspace[]> {
  const rows = await db.selectFrom('workspace').select(WORKSPACE_COLUMNS)
    .orderBy('name').orderBy('slug').limit(MAX_WORKSPACES).execute();
  return rows.map(toWorkspace);
}

/** Creates the workspace with its owner, in one transaction. */
export function createOwnedWorkspace(
  db: Kysely<Database>,
  input: WorkspaceInput,
  ownerId: string,
): Promise<MemberWorkspace> {
  return inTransaction(db, async (trx) => {
    const workspace = await createWorkspace(trx, input);
    await addMember(trx, { workspaceId: workspace.id, userId: ownerId, role: 'owner' });
    return { ...workspace, role: 'owner' as const };
  });
}

/** Makes every instance administrator owner of the workspaces (all of them by default) they are not a member of. */
export async function makeAdminsOwners(db: Kysely<Database>, workspaceIds?: readonly string[]): Promise<void> {
  const createdAt = toTimestamp(new Date());
  await db.insertInto('member')
    .columns(['workspaceId', 'userId', 'role', 'createdAt'])
    .expression((eb) => {
      let query = eb.selectFrom(['workspace', 'user'])
        .select((select) => [
          'workspace.id as workspaceId', 'user.id as userId', select.val('owner').as('role'),
          select.val(createdAt).as('createdAt'),
        ])
        .where('user.role', '=', 'admin')
        .where((where) => where.not(where.exists(where.selectFrom('member').select('member.userId')
          .whereRef('member.workspaceId', '=', 'workspace.id').whereRef('member.userId', '=', 'user.id'))));
      if (workspaceIds) {
        query = query.where('workspace.id', 'in', workspaceIds);
      }
      return query;
    })
    .execute();
}

export interface WorkspaceMember {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: Date;
}

const selectMembers = (db: Kysely<Database>, workspaceId: string) => db.selectFrom('member')
  .innerJoin('user', 'user.id', 'member.userId')
  .select(['member.userId', 'user.name', 'user.email', 'member.role', 'member.createdAt'])
  .where('member.workspaceId', '=', workspaceId);

const toMember = ({ createdAt, ...row }: Omit<WorkspaceMember, 'joinedAt'> & { createdAt: string }): WorkspaceMember =>
  ({ ...row, joinedAt: fromTimestamp(createdAt, 'member.createdAt') });

/** The workspace's members, by name. */
export async function listMembers(db: Kysely<Database>, workspaceId: string): Promise<WorkspaceMember[]> {
  const rows = await selectMembers(db, workspaceId).orderBy('user.name').orderBy('user.email').execute();
  return rows.map(toMember);
}

/** The member, or why the change was refused: not a member, or it would leave the workspace without an owner. */
export type MemberChange = WorkspaceMember | 'member_not_found' | 'last_owner';

/**
 * Runs a change to a member with the workspace's row locked, so that two changes at once see each other: two owners
 * demoting each other cannot both go through. SQLite runs one write transaction at a time anyway.
 */
function changeMember(
  db: Kysely<Database>,
  workspaceId: string,
  userId: string,
  { keepsOwner, apply }: { keepsOwner: boolean; apply: (trx: Kysely<Database>) => Promise<unknown> },
): Promise<MemberChange> {
  return inTransaction(db, async (trx) => {
    await trx.updateTable('workspace').set((update) => ({ id: update.ref('id') })).where('id', '=', workspaceId).execute();
    const member = await selectMembers(trx, workspaceId).where('member.userId', '=', userId).executeTakeFirst();
    if (!member) {
      return 'member_not_found';
    }
    if (member.role === 'owner' && !keepsOwner) {
      const owners = await trx.selectFrom('member').select((count) => count.fn.countAll<number | string>().as('n'))
        .where('workspaceId', '=', workspaceId).where('role', '=', 'owner').executeTakeFirstOrThrow();
      if (Number(owners.n) <= 1) {
        return 'last_owner';
      }
    }
    await apply(trx);
    return toMember(member);
  });
}

/** Changes a member's role, unless it would leave the workspace without an owner. */
export async function setMemberRole(
  db: Kysely<Database>,
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): Promise<MemberChange> {
  const change = await changeMember(db, workspaceId, userId, {
    keepsOwner: role === 'owner',
    apply: (trx) => trx.updateTable('member').set({ role })
      .where('workspaceId', '=', workspaceId).where('userId', '=', userId).execute(),
  });
  return typeof change === 'string' ? change : { ...change, role };
}

/** Removes a member, unless it would leave the workspace without an owner. */
export function removeMember(db: Kysely<Database>, workspaceId: string, userId: string): Promise<MemberChange> {
  return changeMember(db, workspaceId, userId, {
    keepsOwner: false,
    apply: (trx) => trx.deleteFrom('member').where('workspaceId', '=', workspaceId).where('userId', '=', userId).execute(),
  });
}
