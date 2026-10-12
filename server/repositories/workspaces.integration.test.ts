import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EntityConflictError, EntityValidationError } from './errors';
import { createWorkspace, deleteWorkspace, getWorkspace } from './workspaces';
import { DIALECTS, openTestDatabase } from '../../tests/support/databases';
import { newId } from '../database/ids';
import { migrateToLatest } from '../database/migrator';

import type { Dialect, TestDatabase } from '../../tests/support/databases';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NOW = new Date('2026-10-12T10:00:00.000Z');

describe.each(DIALECTS)('workspaces on %s', (dialect: Dialect) => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = await openTestDatabase(dialect);
    await migrateToLatest(database.db);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await database.cleanup();
  });

  it('given a name and a kebab-case slug, creates a workspace with a UUIDv7 id and timestamps', async () => {
    const workspace = await createWorkspace(database.db, { name: 'Demo homelab', slug: 'demo' });

    expect(workspace).toEqual({
      id: expect.stringMatching(UUID_V7) as unknown,
      name: 'Demo homelab',
      slug: 'demo',
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(await getWorkspace(database.db, workspace.id)).toEqual(workspace);
    expect(await getWorkspace(database.db, newId())).toBeUndefined();
  });

  it('given an invalid name or slug, fails with a validation error', async () => {
    await expect(createWorkspace(database.db, { name: '', slug: 'Not Kebab' })).rejects.toMatchObject({
      constructor: EntityValidationError,
      issues: [{ path: 'name' }, { path: 'slug' }],
    });
  });

  it('given a slug another workspace has, fails with a conflict error on slug', async () => {
    await createWorkspace(database.db, { name: 'Demo', slug: 'demo' });

    await expect(createWorkspace(database.db, { name: 'Another demo', slug: 'demo' })).rejects.toMatchObject({
      constructor: EntityConflictError,
      fields: ['slug'],
    });
  });

  it('given a database failure other than a conflict, rethrows it', async () => {
    const closed = await database.reopen();
    await closed.destroy();

    await expect(createWorkspace(closed, { name: 'Demo', slug: 'demo' })).rejects.not.toBeInstanceOf(EntityConflictError);
  });

  it('deletes a workspace, and reports when there was none', async () => {
    const workspace = await createWorkspace(database.db, { name: 'Demo', slug: 'demo' });
    const other = await createWorkspace(database.db, { name: 'Other', slug: 'other' });

    expect(await deleteWorkspace(database.db, workspace.id)).toBe(true);

    expect(await getWorkspace(database.db, workspace.id)).toBeUndefined();
    expect(await getWorkspace(database.db, other.id)).toEqual(other);
    expect(await deleteWorkspace(database.db, workspace.id)).toBe(false);
  });
});
