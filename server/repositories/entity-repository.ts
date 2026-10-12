import type { Database } from '../database/types/schema';
import type { EntityRepositoryDefinition, RepositoryScope, ScopedRepository } from '@stackmap/extension-sdk/server';
import type { Kysely } from 'kysely';

/** The connection (or transaction) a repository uses, and its scope. */
export interface RepositoryContext {
  db: Kysely<Database>;
  scope: RepositoryScope;
}

/** Builds the repository of an entity from its definition: every query is limited to the scope's workspace. */
export function createEntityRepository<Fields, Input, DB>(
  _definition: EntityRepositoryDefinition<Fields, Input, DB>,
): (context: RepositoryContext) => ScopedRepository<unknown, unknown, unknown, object> {
  throw new Error('Not implemented');
}
