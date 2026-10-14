import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { countRows } from './workspaces';
import { newId } from '../../server/database/ids';
import { EntityValidationError } from '../../server/repositories/errors';

import type { ScopedTable, TestWorkspaces } from './workspaces';
import type { WorkspaceRepositories } from '../../server/repositories';
import type {} from '../../extensions/core/server/repositories';
import type { EntityMeta } from '@stackmap/extension-sdk/entities';

type RepositoryName = Exclude<keyof WorkspaceRepositories, 'transaction'>;

type LooseEntity = EntityMeta & Record<string, unknown>;

/** Any repository, seen through the methods every one has. */
interface LooseRepository {
  create: (input: object) => Promise<LooseEntity>;
  get: (id: string) => Promise<LooseEntity | undefined>;
  list: () => Promise<LooseEntity[]>;
  update: (id: string, patch: object) => Promise<LooseEntity | undefined>;
  remove: (id: string) => Promise<boolean>;
}

export interface RepositoryCase {
  workspaces: TestWorkspaces;
  repository: RepositoryName;
  table: Exclude<ScopedTable, 'core_hostAddress'>;
  /** Valid input for the workspace of these repositories, creating the parents it needs there. */
  input: (repos: WorkspaceRepositories) => Promise<object>;
  /** A valid patch that changes some fields. */
  patch: Record<string, unknown>;
  /** Fields with invalid values, and the paths of the issues they cause. */
  invalid: { input: Record<string, unknown>; paths: string[] };
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CREATED = new Date('2026-10-12T10:00:00.000Z');
const UPDATED = new Date('2026-10-12T11:30:00.000Z');

const COMMON_VALUES = {
  tags: ['web', 'prod'],
  notes: '# Notes\n\nBehind the router.',
  links: [{ label: 'Docs', url: 'https://docs.homelab.example/' }],
  customFields: { rack: 'A1', units: 2, ups: true, owner: null },
  externalRef: 'vm-104',
};

/**
 * Behaviour every workspace-scoped repository shares: create, read, list, update, validation, workspace isolation and
 * explicit columns. Run it inside a `describe` that called `useTestWorkspaces`.
 */
export function describeScopedRepository(c: RepositoryCase): void {
  const repository = (repos: WorkspaceRepositories) => repos[c.repository] as unknown as LooseRepository;
  const create = async (repos: WorkspaceRepositories, extra: object = {}) =>
    repository(repos).create({ ...(await c.input(repos)), ...extra });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(CREATED);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe(`${c.repository}: common behaviour`, () => {
    it('given valid input, creates the entity with a UUIDv7 id, the scope\'s workspace, the actor and timestamps', async () => {
      const { a } = c.workspaces;

      const entity = await create(a.repos);

      expect(entity.id).toMatch(UUID_V7);
      expect(entity).toMatchObject({
        workspaceId: a.workspace.id,
        createdBy: 'actor-a',
        updatedBy: 'actor-a',
        createdAt: CREATED,
        updatedAt: CREATED,
      });
    });

    it('returns the entity shape: dates as Date, parsed JSON, defaults applied', async () => {
      const { a } = c.workspaces;

      const defaults = await create(a.repos);
      const filled = await create(a.repos, { ...COMMON_VALUES, status: 'planned' });

      expect(defaults).toMatchObject({
        status: 'active', tags: [], notes: '', links: [], customFields: {}, origin: 'manual', externalRef: null,
      });
      expect(defaults.createdAt).toBeInstanceOf(Date);
      expect(filled).toMatchObject({ ...COMMON_VALUES, status: 'planned' });
      expect(await repository(a.repos).get(filled.id)).toEqual(filled);
    });

    it('gets an entity of the workspace by id, and undefined for an unknown id', async () => {
      const { a } = c.workspaces;
      const entity = await create(a.repos);

      expect(await repository(a.repos).get(entity.id)).toEqual(entity);
      expect(await repository(a.repos).get(newId())).toBeUndefined();
      expect(await repository(a.repos).get('not-an-id')).toBeUndefined();
    });

    it('given a malformed id (not a UUID, an array, an object), finds nothing and changes nothing', async () => {
      const { a } = c.workspaces;
      const entity = await create(a.repos);

      for (const id of ['not-an-id', [entity.id, entity.id], { id: entity.id }] as unknown as string[]) {
        expect(await repository(a.repos).get(id)).toBeUndefined();
        expect(await repository(a.repos).update(id, c.patch)).toBeUndefined();
        expect(await repository(a.repos).remove(id)).toBe(false);
      }
      expect(await repository(a.repos).get(entity.id)).toEqual(entity);
    });

    it('lists the workspace\'s entities in creation order', async () => {
      const { a } = c.workspaces;
      const first = await create(a.repos);
      const second = await create(a.repos);
      const third = await create(a.repos);

      expect((await repository(a.repos).list()).map(({ id }) => id)).toEqual([first.id, second.id, third.id]);
    });

    it('given a patch, changes only the given fields, sets updatedAt and updatedBy, keeps createdAt and createdBy', async () => {
      const { a } = c.workspaces;
      const entity = await create(a.repos);
      vi.setSystemTime(UPDATED);

      const updated = await repository(c.workspaces.repositories(a.workspace.id, { actorId: 'actor-b' }))
        .update(entity.id, { ...c.patch, tags: ['moved'] });

      expect(updated).toEqual({ ...entity, ...c.patch, tags: ['moved'], updatedAt: UPDATED, updatedBy: 'actor-b' });
      expect(await repository(a.repos).get(entity.id)).toEqual(updated);
    });

    it('given an empty patch, changes nothing but updatedAt and updatedBy', async () => {
      const { a } = c.workspaces;
      const entity = await create(a.repos);
      vi.setSystemTime(UPDATED);

      const asSystem = c.workspaces.repositories(a.workspace.id, { actorId: null });
      const updated = await repository(asSystem).update(entity.id, {});

      expect(updated).toEqual({ ...entity, updatedAt: UPDATED, updatedBy: null });
    });

    it('given invalid input, fails with a validation error listing every issue with its path, and writes nothing', async () => {
      const { a, db } = c.workspaces;
      const entity = await create(a.repos);

      const error: unknown = await create(a.repos, c.invalid.input).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(EntityValidationError);
      expect((error as EntityValidationError).issues.map(({ path }) => path))
        .toEqual(expect.arrayContaining(c.invalid.paths));
      expect(await countRows(db, c.table, a.workspace.id)).toBe(1);

      await expect(repository(a.repos).update(entity.id, c.invalid.input))
        .rejects.toBeInstanceOf(EntityValidationError);
      expect(await repository(a.repos).get(entity.id)).toEqual(entity);
    });
  });

  describe(`${c.repository}: workspace isolation`, () => {
    it('given workspaces A and B, A\'s list never returns B\'s entity', async () => {
      const { a, b } = c.workspaces;
      const ownEntity = await create(a.repos);
      await create(b.repos);

      expect((await repository(a.repos).list()).map(({ id }) => id)).toEqual([ownEntity.id]);
    });

    it('A\'s get of B\'s entity returns undefined', async () => {
      const { a, b } = c.workspaces;
      const theirs = await create(b.repos);

      expect(await repository(a.repos).get(theirs.id)).toBeUndefined();
    });

    it('A\'s update of B\'s entity returns undefined and leaves it unchanged', async () => {
      const { a, b } = c.workspaces;
      const theirs = await create(b.repos);

      expect(await repository(a.repos).update(theirs.id, c.patch)).toBeUndefined();
      expect(await repository(b.repos).get(theirs.id)).toEqual(theirs);
    });

    it('A\'s remove of B\'s entity returns false and leaves it in place', async () => {
      const { a, b } = c.workspaces;
      const theirs = await create(b.repos);

      expect(await repository(a.repos).remove(theirs.id)).toBe(false);
      expect(await repository(b.repos).get(theirs.id)).toEqual(theirs);
    });

    it('given a column the repository does not declare, never returns it', async () => {
      const { a, db } = c.workspaces;
      const entity = await create(a.repos);
      await sql`alter table ${sql.table(c.table)} add column secret text`.execute(db);
      await sql`update ${sql.table(c.table)} set secret = 'leaked'`.execute(db);

      expect(await repository(a.repos).get(entity.id)).not.toHaveProperty('secret');
      expect((await repository(a.repos).list())[0]).not.toHaveProperty('secret');
    });
  });
}
