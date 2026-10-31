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

/** Seeds the demo stack into workspace `demo` when it is missing, unless `STACKMAP_DEMO` is `false`. */
export function seedDemoWorkspace(_db: Kysely<Database>, _options: SeedDemoOptions): Promise<void> {
  return Promise.reject(new Error('Not implemented'));
}
