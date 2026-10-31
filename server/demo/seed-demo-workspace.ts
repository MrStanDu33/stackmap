import { seedDemoStack } from './demo-stack';
import { DEMO_WORKSPACE_SLUG } from '../../shared/contracts/workspaces';
import { createWorkspaceRepositories } from '../repositories';
import { EntityConflictError } from '../repositories/errors';
import { createWorkspace, getWorkspaceBySlug } from '../repositories/workspaces';

import type { WorkspaceInput } from '../../shared/workspace';
import type { Database } from '../database/types/schema';
import type { ExtensionRegistry } from '../extensions/registry';
import type { WorkspaceRepositories } from '../repositories';
import type { Kysely } from 'kysely';

export const DEMO_WORKSPACE: WorkspaceInput = { name: 'Demo', slug: DEMO_WORKSPACE_SLUG };

/** Values of `STACKMAP_DEMO` that turn the seed off, in any case. */
const OFF = new Set(['false', '0', 'no', 'off']);

export interface SeedDemoOptions {
  env: { STACKMAP_DEMO?: string };
  registry: Pick<ExtensionRegistry, 'repositories' | 'flowDerivers' | 'kinds' | 'hasKind'>;
  logger: { info: (message: string) => void; error: (message: string) => void };
  /** What fills the workspace: the demo stack. */
  seed?: (repos: WorkspaceRepositories) => Promise<unknown>;
}

/**
 * Seeds the demo stack into workspace `demo` when it is missing, unless `STACKMAP_DEMO` is `false`, `0`, `no` or
 * `off`. An existing `demo` workspace is never touched. The workspace and its data are written in one transaction, so a
 * failed or interrupted seed leaves nothing and the next start tries again.
 */
export async function seedDemoWorkspace(
  db: Kysely<Database>,
  { env, registry, logger, seed = seedDemoStack }: SeedDemoOptions,
): Promise<void> {
  if (OFF.has(env.STACKMAP_DEMO?.trim().toLowerCase() ?? '') || await getWorkspaceBySlug(db, DEMO_WORKSPACE.slug)) {
    return;
  }
  try {
    await db.transaction().execute(async (trx) => {
      const { id: workspaceId } = await createWorkspace(trx, DEMO_WORKSPACE);
      await seed(createWorkspaceRepositories(registry.repositories(), { flowDerivers: registry.flowDerivers() })(trx, {
        workspaceId, actorId: null, kinds: registry,
      }));
    });
  } catch (error) {
    // Another instance on the same database created it first, and seeds it.
    if (!(error instanceof EntityConflictError)) {
      logger.error(`Could not seed the demo workspace: ${error instanceof Error ? error.message : String(error)}`);
    }
    return;
  }
  logger.info('Seeded the demo workspace');
}
