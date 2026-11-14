import { useDatabase } from './database';
import { useExtensionRegistry } from './extensions';
import { createWorkspaceRepositories } from '../repositories';

import type { AuthorizedWorkspace } from './contract-handler';
import type { Session } from '../../shared/contracts/auth';
import type { WorkspaceRepositories } from '../repositories';

/**
 * The repositories of a workspace the membership check authorized: the only way routes reach a workspace's data, so
 * none can scope them to an id taken from the request. Writes are made as the session's user, audited, and refresh
 * the derived flows.
 */
export async function workspaceRepositories(
  workspace: AuthorizedWorkspace,
  session: Session | null = null,
): Promise<WorkspaceRepositories> {
  const registry = useExtensionRegistry();
  return createWorkspaceRepositories(registry.repositories(), { flowDerivers: registry.flowDerivers() })(
    await useDatabase(),
    { workspaceId: workspace.id, actorId: session?.user.id ?? null, kinds: registry },
  );
}
