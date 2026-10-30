import { sql } from 'kysely';
import { afterEach, beforeEach } from 'vitest';

import { openTestDatabase } from './databases';
import { migrateToLatest } from '../../server/database/migrator';
import { BUILTIN_EXTENSION_SERVERS, BUILTIN_EXTENSIONS } from '../../server/extensions/builtin';
import { migrateExtensions } from '../../server/extensions/migrations';
import { createExtensionRegistry } from '../../server/extensions/registry';
import { createWorkspaceRepositories } from '../../server/repositories';
import { createWorkspace as insertWorkspace } from '../../server/repositories/workspaces';

import type { Dialect, TestDatabase } from './databases';
import type { ReverseProxyDatabase } from '../../extensions/reverse-proxy/server/types/schema';
import type { Database } from '../../server/database/types/schema';
import type { WorkspaceRepositories } from '../../server/repositories';
import type { Workspace, WorkspaceInput } from '../../shared/workspace';
import type { KindCatalog, RepositoryScope } from '@stackmap/extension-sdk/server';
import type { Kysely } from 'kysely';

/** The platform's tables and the built-in extensions'. */
export type TestSchema = Database & ReverseProxyDatabase;

/** The built-in extensions, as the app starts them. */
export const BUILTIN_REGISTRY = createExtensionRegistry(BUILTIN_EXTENSIONS, { servers: BUILTIN_EXTENSION_SERVERS });

/** The kinds of the built-in extensions. */
export const BUILTIN_KINDS: KindCatalog = BUILTIN_REGISTRY;

/** The user the test repositories act as. */
export const ACTOR = 'actor-a';

const quiet = { info: () => undefined };

let sequence = 0;

export function buildWorkspace(overrides: Partial<WorkspaceInput> = {}): WorkspaceInput {
  sequence += 1;
  return { name: `Workspace ${String(sequence)}`, slug: `workspace-${String(sequence)}`, ...overrides };
}

export function createWorkspace(db: Kysely<Database>, overrides: Partial<WorkspaceInput> = {}): Promise<Workspace> {
  return insertWorkspace(db, buildWorkspace(overrides));
}

export interface TestWorkspace {
  workspace: Workspace;
  repos: WorkspaceRepositories;
}

export interface TestWorkspaces {
  readonly db: Kysely<TestSchema>;
  readonly a: TestWorkspace;
  readonly b: TestWorkspace;
  /** Repositories of a workspace, acting as another user or with other kinds. */
  repositories: (workspaceId: string, scope?: Partial<Omit<RepositoryScope, 'workspaceId'>>) => WorkspaceRepositories;
}

/**
 * Gives each test of the enclosing `describe` a fresh database, migrated like the app (its migrations, then the
 * built-in extensions'), with two workspaces, A and B, and their repositories.
 */
export function useTestWorkspaces(dialect: Dialect): TestWorkspaces {
  let database: TestDatabase | undefined;
  let build: ReturnType<typeof createWorkspaceRepositories> | undefined;
  let a: TestWorkspace | undefined;
  let b: TestWorkspace | undefined;

  const ready = <T>(value: T | undefined): T => {
    if (value === undefined) {
      throw new Error('The test workspaces exist only inside a test.');
    }
    return value;
  };
  const repositories: TestWorkspaces['repositories'] = (workspaceId, scope = {}) =>
    ready(build)(ready(database).db, { workspaceId, actorId: ACTOR, kinds: BUILTIN_KINDS, ...scope });

  beforeEach(async () => {
    database = await openTestDatabase(dialect);
    await migrateToLatest(database.db);
    await migrateExtensions(database.db, BUILTIN_REGISTRY, quiet);
    build = createWorkspaceRepositories(BUILTIN_REGISTRY.repositories(), {
      flowDerivers: BUILTIN_REGISTRY.flowDerivers(),
    });
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
      return ready(database).db as unknown as Kysely<TestSchema>;
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
  'core_site', 'core_network', 'core_host', 'core_hostAddress', 'core_service', 'core_listener', 'core_domain',
  'core_dnsRecord', 'core_flow', 'reverse_proxy_route', 'reverse_proxy_routeHostname',
] as const satisfies readonly (keyof TestSchema)[];

export type ScopedTable = (typeof SCOPED_TABLES)[number];

/** How many rows of a table belong to a workspace. */
export async function countRows(db: Kysely<TestSchema>, table: ScopedTable, workspaceId: string): Promise<number> {
  const { rows } = await sql<{ count: number | string }>`
    select count(*) as count from ${sql.table(table)} where ${sql.ref('workspaceId')} = ${workspaceId}
  `.execute(db);
  return Number(rows[0]?.count ?? 0);
}
