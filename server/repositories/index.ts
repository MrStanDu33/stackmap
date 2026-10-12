import type { Database } from '../database/types/schema';
import type { EntityRepositories, EntityRepositoryDefinition, RepositoryScope } from '@stackmap/extension-sdk/server';
import type { Kysely } from 'kysely';

/** The repositories of one workspace: the only way to read or write its entities. */
export type WorkspaceRepositories = EntityRepositories & {
  /** Runs the work with repositories of the same workspace on one transaction: all of it is kept, or none. */
  transaction: <T>(work: (repos: WorkspaceRepositories) => Promise<T>) => Promise<T>;
};

/** Builds the repositories of the active extensions' entities, for a workspace. */
export function createWorkspaceRepositories(
  _definitions: readonly EntityRepositoryDefinition[],
): (db: Kysely<Database>, scope: RepositoryScope) => WorkspaceRepositories {
  throw new Error('Not implemented');
}
