import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { EntityConflictError } from './errors';
import { addMember, createOwnedWorkspace, roleIn, workspacesOf } from './members';
import { createAccount, membersOf } from '../../tests/support/accounts';
import { DIALECTS } from '../../tests/support/databases';
import { createWorkspace, useTestWorkspaces } from '../../tests/support/workspaces';

import type { Dialect } from '../../tests/support/databases';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

describe.each(DIALECTS)('workspace members on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const ada = () => createAccount(db(), { name: 'Ada', email: 'ada@homelab.example', admin: true });
  const grace = () => createAccount(db(), { name: 'Grace', email: 'grace@homelab.example' });

  it('deletes a membership with its workspace or its user (2)', async () => {
    const { user } = await grace();
    await addMember(db(), { workspaceId: workspaces.a.workspace.id, userId: user.id, role: 'editor' });
    await addMember(db(), { workspaceId: workspaces.b.workspace.id, userId: user.id, role: 'viewer' });

    await db().deleteFrom('workspace').where('id', '=', workspaces.a.workspace.id).execute();
    expect(await membersOf(db(), workspaces.a.workspace.id)).toEqual({});
    expect(await membersOf(db(), workspaces.b.workspace.id)).toEqual({ [user.id]: 'viewer' });

    await db().deleteFrom('user').where('id', '=', user.id).execute();
    expect(await membersOf(db(), workspaces.b.workspace.id)).toEqual({});
  });

  it('keeps one membership per workspace and user, and refuses a role outside owner, admin, editor, viewer (3)', async () => {
    const { user } = await grace();
    const workspaceId = workspaces.a.workspace.id;
    await addMember(db(), { workspaceId, userId: user.id, role: 'editor' });

    await expect(addMember(db(), { workspaceId, userId: user.id, role: 'viewer' })).rejects.toThrow();
    await expect(sql`insert into member ("workspaceId", "userId", role, "createdAt")
      values (${workspaces.b.workspace.id}, ${user.id}, 'superuser', '2026-11-01T00:00:00.000Z')`.execute(db()))
      .rejects.toThrow();
    expect(await roleIn(db(), user.id, workspaceId)).toBe('editor');
    expect(await roleIn(db(), user.id, workspaces.b.workspace.id)).toBeUndefined();
  });

  it('lists a user\'s workspaces by name with their role, and none for a user without membership (13)', async () => {
    const { user } = await grace();
    const zulu = await createWorkspace(db(), { name: 'Zulu', slug: 'zulu' });
    const alpha = await createWorkspace(db(), { name: 'Alpha', slug: 'alpha' });
    await addMember(db(), { workspaceId: zulu.id, userId: user.id, role: 'viewer' });
    await addMember(db(), { workspaceId: alpha.id, userId: user.id, role: 'admin' });

    expect((await workspacesOf(db(), user.id)).map(({ slug, role }) => [slug, role]))
      .toEqual([['alpha', 'admin'], ['zulu', 'viewer']]);
    expect(await workspacesOf(db(), (await ada()).user.id)).toEqual([]);
  });

  it('creates a workspace and its owner together, or neither when the slug is taken (14, 15)', async () => {
    const { user } = await ada();

    const created = await createOwnedWorkspace(db(), { name: 'Homelab', slug: 'homelab' }, user.id);

    expect(created).toMatchObject({ name: 'Homelab', slug: 'homelab', role: 'owner' });
    expect(await membersOf(db(), created.id)).toEqual({ [user.id]: 'owner' });
    await expect(createOwnedWorkspace(db(), { name: 'Other', slug: 'homelab' }, user.id))
      .rejects.toBeInstanceOf(EntityConflictError);
    expect(await workspacesOf(db(), user.id)).toHaveLength(1);
  });
});
