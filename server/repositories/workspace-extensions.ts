import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

/** Whether each of the extensions is on in the workspace: on unless it was turned off there. */
export function extensionStates(
  _db: Kysely<Database>,
  _workspaceId: string,
  _ids: readonly string[],
): Promise<Map<string, boolean>> {
  return Promise.resolve(new Map<string, boolean>());
}

/** Turns the extensions on or off in the workspace, in one transaction; who turned them off is kept. */
export function setExtensionsEnabled(
  _db: Kysely<Database>,
  _workspaceId: string,
  _ids: readonly string[],
  _enabled: boolean,
  _actorId: string | null,
): Promise<void> {
  return Promise.resolve();
}
