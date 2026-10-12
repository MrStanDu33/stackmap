import { sql } from 'kysely';
import { afterEach, beforeEach } from 'vitest';

import { openTestDatabase } from './databases';
import { migrateToLatest } from '../../server/database/migrator';
import { BUILTIN_EXTENSIONS } from '../../server/extensions/builtin';
import { createExtensionRegistry } from '../../server/extensions/registry';
import { workspaceRepositories } from '../../server/repositories';
import { createWorkspace } from '../factories';

import type { Dialect, TestDatabase } from './databases';
import type { Database } from '../../server/database/types/schema';
import type { KindCatalog, RepositoryScope, WorkspaceRepositories } from '../../server/repositories';
import type { Workspace } from '../../shared/entities';
import type { Kysely } from 'kysely';

/** The kinds of the built-in extensions. */
export const BUILTIN_KINDS: KindCatalog = createExtensionRegistry(BUILTIN_EXTENSIONS);

/** The user the test repositories act as. */
export const ACTOR = 'actor-a';

export interface TestWorkspace {
  workspace: Workspace;
  repos: WorkspaceRepositories;
}

export interface TestWorkspaces {
  readonly db: Kysely<Database>;
  readonly a: TestWorkspace;
  readonly b: TestWorkspace;
  /** Repositories of a workspace, acting as another user or with other kinds. */
  repositories: (workspaceId: string, scope?: Partial<Omit<RepositoryScope, 'workspaceId'>>) => WorkspaceRepositories;
}

/**
 * Gives each test of the enclosing `describe` a fresh, migrated database with two workspaces, A and B, and their
 * repositories.
 */
export function useTestWorkspaces(dialect: Dialect): TestWorkspaces {
  let database: TestDatabase | undefined;
  let a: TestWorkspace | undefined;
  let b: TestWorkspace | undefined;

  const ready = <T>(value: T | undefined): T => {
    if (value === undefined) {
      throw new Error('The test workspaces exist only inside a test.');
    }
    return value;
  };
  const repositories: TestWorkspaces['repositories'] = (workspaceId, scope = {}) =>
    workspaceRepositories(ready(database).db, { workspaceId, actorId: ACTOR, kinds: BUILTIN_KINDS, ...scope });

  beforeEach(async () => {
    database = await openTestDatabase(dialect);
    await migrateToLatest(database.db);
    const workspaceA = await createWorkspace(database.db);
    const workspaceB = await createWorkspace(database.db);
    a = { workspace: workspaceA, repos: repositories(workspaceA.id) };
    b = { workspace: workspaceB, repos: repositories(workspaceB.id) };
  });

  afterEach(async () => {
    await database?.cleanup();
    database = undefined;
  });

  return {
    get db() {
      return ready(database).db;
    },
    get a() {
      return ready(a);
    },
    get b() {
      return ready(b);
    },
    repositories,
  };
}

/** Tables whose rows belong to a workspace. */
export const SCOPED_TABLES = [
  'site', 'network', 'host', 'hostAddress', 'service', 'listener', 'domain', 'dnsRecord',
] as const satisfies readonly (keyof Database)[];

export type ScopedTable = (typeof SCOPED_TABLES)[number];

/** How many rows of a table belong to a workspace. */
export async function countRows(db: Kysely<Database>, table: ScopedTable, workspaceId: string): Promise<number> {
  const { rows } = await sql<{ count: number | string }>`
    select count(*) as count from ${sql.table(table)} where ${sql.ref('workspaceId')} = ${workspaceId}
  `.execute(db);
  return Number(rows[0]?.count ?? 0);
}
