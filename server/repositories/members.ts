import { inTransaction } from './entity-repository';
import { createWorkspace, toWorkspace, WORKSPACE_COLUMNS } from './workspaces';
import { MAX_WORKSPACES } from '../../shared/contracts/workspaces';
import { toTimestamp } from '../database/serialize';

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
