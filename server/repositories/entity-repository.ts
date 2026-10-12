import type { ExtensionRegistry } from '../extensions/registry';

/** Tells which kinds the active extensions provide. */
export type KindCatalog = Pick<ExtensionRegistry, 'hasKind'>;

/** Who the repositories act for: one workspace, one user (none before accounts exist, or for the system). */
export interface RepositoryScope {
  workspaceId: string;
  actorId: string | null;
  kinds: KindCatalog;
}

/** Reads and writes one entity type of one workspace; nothing outside that workspace is visible. */
export interface ScopedRepository<Entity, Input, Patch, Filter extends object = never> {
  create: (input: Input) => Promise<Entity>;
  /** Undefined when the workspace has no such entity. */
  get: (id: string) => Promise<Entity | undefined>;
  /** In creation order. */
  list: (filter?: Filter) => Promise<Entity[]>;
  /** Undefined when the workspace has no such entity. */
  update: (id: string, patch: Patch) => Promise<Entity | undefined>;
  /** False when the workspace has no such entity. */
  remove: (id: string) => Promise<boolean>;
}
