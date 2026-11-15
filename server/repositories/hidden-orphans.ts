import type { WorkspaceRepositories } from './index';
import type { Database } from '../database/types/schema';
import type { RegisteredRepository } from '../extensions/registry';
import type { Kysely } from 'kysely';

/** Most orphans listed per entity type. */
export const MAX_ORPHANS = 200;

/** A hidden entity no flow is based on, as the entity API sends it. */
export interface HiddenOrphan {
  entity: string;
  id: string;
  fields: Record<string, unknown>;
}

export interface OrphanWorkspace {
  db: Kysely<Database>;
  repos: WorkspaceRepositories;
  workspaceId: string;
}

/**
 * The entities of an extension (its repository definitions) that no stored derived flow of the workspace is based
 * on, less those kept hidden; at most MAX_ORPHANS per type, `truncated` when there were more.
 */
export function listHiddenOrphans(
  _workspace: OrphanWorkspace,
  _definitions: readonly RegisteredRepository[],
): Promise<{ items: HiddenOrphan[]; truncated: boolean }> {
  return Promise.resolve({ items: [], truncated: false });
}

/** Whether a stored derived flow of the workspace is based on the entity. */
export function isConnected(
  _db: Kysely<Database>, _workspaceId: string, _entity: string, _id: string,
): Promise<boolean> {
  return Promise.resolve(false);
}

/** Keeps a hidden entity hidden: it leaves the orphans; marking it again changes nothing. */
export function keepHiddenEntity(
  _db: Kysely<Database>,
  _workspaceId: string,
  _entity: { extension: string; entity: string; id: string },
  _actorId: string | null,
): Promise<void> {
  return Promise.resolve();
}
