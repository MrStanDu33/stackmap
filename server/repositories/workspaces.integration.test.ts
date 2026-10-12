import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EntityConflictError, EntityValidationError } from './errors';
import { createWorkspace, deleteWorkspace, getWorkspace } from './workspaces';
import { populateWorkspace } from '../../tests/factories';
import { DIALECTS } from '../../tests/support/databases';
import { countRows, SCOPED_TABLES, useTestWorkspaces } from '../../tests/support/workspaces';
import { newId } from '../database/ids';

import type { Dialect } from '../../tests/support/databases';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NOW = new Date('2026-10-12T10:00:00.000Z');

describe.each(DIALECTS)('workspaces on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('given a name and a kebab-case slug, creates a workspace with a UUIDv7 id and timestamps', async () => {
    const workspace = await createWorkspace(workspaces.db, { name: 'Demo homelab', slug: 'demo' });

    expect(workspace).toEqual({
      id: expect.stringMatching(UUID_V7) as unknown,
      name: 'Demo homelab',
      slug: 'demo',
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(await getWorkspace(workspaces.db, workspace.id)).toEqual(workspace);
    expect(await getWorkspace(workspaces.db, newId())).toBeUndefined();
  });

  it('given an invalid name or slug, fails with a validation error', async () => {
    await expect(createWorkspace(workspaces.db, { name: '', slug: 'Not Kebab' })).rejects.toMatchObject({
      constructor: EntityValidationError,
      issues: [{ path: 'name' }, { path: 'slug' }],
    });
  });

  it('given a slug another workspace has, fails with a conflict error on slug', async () => {
    await createWorkspace(workspaces.db, { name: 'Demo', slug: 'demo' });

    await expect(createWorkspace(workspaces.db, { name: 'Another demo', slug: 'demo' })).rejects.toMatchObject({
      constructor: EntityConflictError,
      fields: ['slug'],
    });
  });

  it('given a workspace with data, deleting it deletes all of its entities and leaves another workspace untouched', async () => {
    const { a, b, db } = workspaces;
    await populateWorkspace(a.repos);
    await populateWorkspace(b.repos);
    const countAll = (workspaceId: string) =>
      Promise.all(SCOPED_TABLES.map((table) => countRows(db, table, workspaceId)));
    const before = await countAll(b.workspace.id);

    expect(await deleteWorkspace(db, a.workspace.id)).toBe(true);

    expect(await countAll(a.workspace.id)).toEqual(SCOPED_TABLES.map(() => 0));
    expect(await countAll(b.workspace.id)).toEqual(before);
    expect(before.every((count) => count > 0)).toBe(true);
    expect(await getWorkspace(db, a.workspace.id)).toBeUndefined();
    expect(await deleteWorkspace(db, a.workspace.id)).toBe(false);
  });
});
