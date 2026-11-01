import { seedDemoStack } from './demo-stack';
import { DEMO_WORKSPACE_SLUG } from '../../shared/contracts/workspaces';
import { createWorkspaceRepositories } from '../repositories';
import { EntityConflictError } from '../repositories/errors';
import { makeAdminsOwners } from '../repositories/members';
import { createWorkspace, getWorkspaceBySlug } from '../repositories/workspaces';
import { isOn } from '../utils/flags';

import type { WorkspaceInput } from '../../shared/workspace';
import type { Database } from '../database/types/schema';
import type { ExtensionRegistry } from '../extensions/registry';
import type { WorkspaceRepositories } from '../repositories';
import type { Kysely } from 'kysely';

export const DEMO_WORKSPACE: WorkspaceInput = { name: 'Demo', slug: DEMO_WORKSPACE_SLUG };

export interface SeedDemoOptions {
  env: { STACKMAP_DEMO?: string };
  registry: Pick<ExtensionRegistry, 'repositories' | 'flowDerivers' | 'kinds' | 'hasKind'>;
  logger: { info: (message: string) => void; error: (message: string) => void };
  /** What fills the workspace: the demo stack. */
  seed?: (repos: WorkspaceRepositories) => Promise<unknown>;
}

/**
 * Seeds the demo stack into workspace `demo` when it is missing and `STACKMAP_DEMO` is `true`, `1`, `yes` or `on`, with
 * every instance administrator as owner. An existing `demo` workspace is never touched. The workspace and its data
 * are written in one transaction, so a failed or interrupted seed leaves nothing and the next start tries again.
 */
export async function seedDemoWorkspace(
  db: Kysely<Database>,
  { env, registry, logger, seed = seedDemoStack }: SeedDemoOptions,
): Promise<void> {
  // Off unless set: setup offers the demo instead.
  if (!isOn(env.STACKMAP_DEMO) || await getWorkspaceBySlug(db, DEMO_WORKSPACE.slug)) {
    return;
  }
  try {
    await db.transaction().execute(async (trx) => {
      const { id: workspaceId } = await createWorkspace(trx, DEMO_WORKSPACE);
      // Before setup there is no administrator yet: setup makes them owner of what exists.
      await makeAdminsOwners(trx, [workspaceId]);
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
