import { seedDemoStack } from './demo-stack';
import { createWorkspaceRepositories } from '../repositories';
import { EntityConflictError } from '../repositories/errors';
import { createWorkspace, deleteWorkspace, getWorkspaceBySlug } from '../repositories/workspaces';

import type { WorkspaceInput } from '../../shared/workspace';
import type { Database } from '../database/types/schema';
import type { ExtensionRegistry } from '../extensions/registry';
import type { WorkspaceRepositories } from '../repositories';
import type { Kysely } from 'kysely';

export const DEMO_WORKSPACE: WorkspaceInput = { name: 'Demo', slug: 'demo' };

export interface SeedDemoOptions {
  env: { STACKMAP_DEMO?: string };
  registry: Pick<ExtensionRegistry, 'repositories' | 'flowDerivers' | 'kinds' | 'hasKind'>;
  logger: { info: (message: string) => void; error: (message: string) => void };
  /** What fills the workspace: the demo stack. */
  seed?: (repos: WorkspaceRepositories) => Promise<unknown>;
}

/**
 * Seeds the demo stack into workspace `demo` when it is missing, unless `STACKMAP_DEMO` is `false`. An existing `demo`
 * workspace is never touched; a seed that fails removes the workspace it created, so the next start tries again.
 */
export async function seedDemoWorkspace(
  db: Kysely<Database>,
  { env, registry, logger, seed = seedDemoStack }: SeedDemoOptions,
): Promise<void> {
  if (env.STACKMAP_DEMO === 'false' || await getWorkspaceBySlug(db, DEMO_WORKSPACE.slug)) {
    return;
  }
  let workspaceId: string;
  try {
    ({ id: workspaceId } = await createWorkspace(db, DEMO_WORKSPACE));
  } catch (error) {
    // Another instance on the same database won the race and seeds it.
    if (error instanceof EntityConflictError) {
      return;
    }
    throw error;
  }
  const repos = createWorkspaceRepositories(registry.repositories(), { flowDerivers: registry.flowDerivers() })(db, {
    workspaceId, actorId: null, kinds: registry,
  });
  try {
    await seed(repos);
  } catch (error) {
    await deleteWorkspace(db, workspaceId);
    logger.error(`Could not seed the demo workspace: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  logger.info('Seeded the demo workspace');
}
