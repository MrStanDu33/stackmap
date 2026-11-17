import type { WorkspaceRepositories } from './index';
import type { Database } from '../database/types/schema';
import type { RegisteredRepository } from '../extensions/registry';
import type { Kysely } from 'kysely';

/** An entity search found. */
export interface SearchHit {
  extension: string;
  entity: string;
  id: string;
  title: string;
  /** The search field whose value matched first, or `tags`. */
  matched: string;
}

type Indexed = Pick<RegisteredRepository, 'extension' | 'entity' | 'search'>;

/** Writes the entity's row of the search index, replacing the one it had. */
export function indexEntity(
  _db: Kysely<Database>, _workspaceId: string, _definition: Indexed, _entity: Record<string, unknown>,
): Promise<void> {
  throw new Error('Not implemented');
}

/** Deletes the entity's row of the search index. */
export function unindexEntity(
  _db: Kysely<Database>, _workspaceId: string, _definition: Indexed, _id: string,
): Promise<void> {
  throw new Error('Not implemented');
}

/** The entities of the workspace whose text matches every word of the query, title prefix first. */
export function searchEntities(
  _workspace: { db: Kysely<Database>; repos: WorkspaceRepositories; workspaceId: string },
  _definitions: readonly RegisteredRepository[],
  _query: { q: string; limit: number },
): Promise<{ items: SearchHit[]; truncated: boolean }> {
  throw new Error('Not implemented');
}

/** Rebuilds every workspace's index when the definitions' search fields changed since it was built; says whether. */
export function refreshSearchIndex(
  _db: Kysely<Database>,
  _definitions: readonly RegisteredRepository[],
  _reposOf: (workspaceId: string) => WorkspaceRepositories,
): Promise<boolean> {
  throw new Error('Not implemented');
}
