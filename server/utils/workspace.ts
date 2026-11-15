import { useDatabase } from './database';
import { useExtensionRegistry } from './extensions';
import { createWorkspaceRepositories } from '../repositories';
import { disabledExtensions } from '../repositories/workspace-extensions';

import type { AuthorizedWorkspace } from './contract-handler';
import type { Session } from '../../shared/contracts/auth';
import type { ExtensionRegistry } from '../extensions/registry';
import type { WorkspaceRepositories } from '../repositories';
import type { KindCatalog } from '@stackmap/extension-sdk/server';

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
  const db = await useDatabase();
  const disabled = await disabledExtensions(db, workspace.id);
  // Flow derivers keep running for disabled extensions: their stored flows stay current for when they come back.
  return createWorkspaceRepositories(registry.repositories(), { flowDerivers: registry.flowDerivers() })(db, {
    workspaceId: workspace.id,
    actorId: session?.user.id ?? null,
    kinds: enabledKinds(registry, disabled),
    disabledExtensions: disabled,
  });
}

/** The kinds of the extensions on in the workspace: one of a disabled extension cannot be set. */
export const enabledKinds = (registry: Pick<ExtensionRegistry, 'kinds'>, disabled: ReadonlySet<string>): KindCatalog => ({
  hasKind: (entity, id) => registry.kinds(entity).some((kind) => kind.id === id && !disabled.has(kind.extension)),
});
