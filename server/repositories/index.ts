import { createEntityRepository, inTransaction } from './entity-repository';

import type { Database } from '../database/types/schema';
import type { EntityRepositories, EntityRepositoryDefinition, RepositoryScope } from '@stackmap/extension-sdk/server';
import type { Kysely } from 'kysely';

/** The repositories of one workspace: the only way to read or write its entities. */
export type WorkspaceRepositories = EntityRepositories & {
  /** Runs the work with repositories of the same workspace on one transaction: all of it is kept, or none. */
  transaction: <T>(work: (repos: WorkspaceRepositories) => Promise<T>) => Promise<T>;
};

/**
 * Builds the repositories of the active extensions' entities, under each definition's key. The scope is copied and
 * frozen: changing the caller's object afterwards cannot move them to another workspace.
 */
export function createWorkspaceRepositories(
  definitions: readonly EntityRepositoryDefinition[],
): (db: Kysely<Database>, scope: RepositoryScope) => WorkspaceRepositories {
  const factories = definitions.map((definition) => [definition.key, createEntityRepository(definition)] as const);
  const build = (db: Kysely<Database>, scope: RepositoryScope): WorkspaceRepositories => {
    const frozen: RepositoryScope = Object.isFrozen(scope) ? scope : Object.freeze({ ...scope });
    const repositories = Object.fromEntries(factories.map(([key, factory]) => [key, factory({ db, scope: frozen })]));
    return {
      ...repositories,
      transaction: (work) => inTransaction(db, (trx) => work(build(trx, frozen))),
    } as WorkspaceRepositories;
  };
  return build;
}
