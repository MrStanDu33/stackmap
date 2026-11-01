import { useDatabase } from './database';
import { useExtensionRegistry } from './extensions';
import { createWorkspaceRepositories } from '../repositories';

import type { AuthorizedWorkspace } from './contract-handler';
import type { WorkspaceRepositories } from '../repositories';

/**
 * The repositories of a workspace the membership check authorized: the only way routes reach a workspace's data, so
 * none can scope them to an id taken from the request. Reads only: no flow derivers run.
 */
export async function workspaceRepositories(workspace: AuthorizedWorkspace): Promise<WorkspaceRepositories> {
  const registry = useExtensionRegistry();
  return createWorkspaceRepositories(registry.repositories())(await useDatabase(), {
    workspaceId: workspace.id, actorId: null, kinds: registry,
  });
}
