import { useDatabase } from './database';
import { useExtensionRegistry } from './extensions';
import { workspaceRepositories } from './workspace';
import { isConnected } from '../repositories/hidden-orphans';
import { disabledExtensions } from '../repositories/workspace-extensions';

import type { AuthorizedWorkspace } from './contract-handler';
import type { Session } from '../../shared/contracts/auth';
import type { ProblemCode } from '../../shared/contracts/errors';
import type { Database } from '../database/types/schema';
import type { RegisteredRepository } from '../extensions/registry';
import type { WorkspaceRepositories } from '../repositories';
import type { Kysely } from 'kysely';

const DETAILS = {
  extension_not_found: 'No installed extension has this id.',
  extension_enabled: 'The extension is on in this workspace: it hides nothing.',
  entity_type_not_found: 'The extension declares no such entity type.',
  entity_not_found: 'No entity of this type with this id in the workspace.',
  hidden_entity_connected: 'A flow of the workspace is based on this entity.',
} as const satisfies Partial<Record<ProblemCode, string>>;

export type OrphanProblem = keyof typeof DETAILS;

export const orphanDetail = (code: OrphanProblem) => DETAILS[code];

export interface HiddenExtension {
  db: Kysely<Database>;
  repos: WorkspaceRepositories;
  reposFor: (on: Kysely<Database>) => Promise<WorkspaceRepositories>;
  /** The extension's active repository definitions. */
  definitions: RegisteredRepository[];
}

/** An installed extension turned off in the workspace, with what reads its entities; or why it is not one. */
export async function hiddenExtension(
  workspace: AuthorizedWorkspace,
  extension: string,
  session: Session | null = null,
): Promise<HiddenExtension | { problem: OrphanProblem }> {
  const registry = useExtensionRegistry();
  if (!registry.get(extension)) {
    return { problem: 'extension_not_found' };
  }
  const db = await useDatabase();
  if (!(await disabledExtensions(db, workspace.id)).has(extension)) {
    return { problem: 'extension_enabled' };
  }
  return {
    db,
    repos: await workspaceRepositories(workspace, session),
    reposFor: (on) => workspaceRepositories(workspace, session, on),
    definitions: registry.repositories().filter((definition) => definition.extension === extension),
  };
}

type Repository = { get: (id: string) => Promise<unknown>; remove: (id: string) => Promise<boolean> };

/** A hidden entity that connects to nothing, with its repository; or why it is not one, with its status. */
export async function hiddenOrphan(
  workspace: AuthorizedWorkspace,
  { extensionId, entity, entityId }: { extensionId: string; entity: string; entityId: string },
  session: Session,
): Promise<
  { db: Kysely<Database>; repository: Repository; hidden: HiddenExtension; definition: RegisteredRepository }
  | { problem: OrphanProblem; status: 404 | 409 }
> {
  const hidden = await hiddenExtension(workspace, extensionId, session);
  if ('problem' in hidden) {
    return { problem: hidden.problem, status: hidden.problem === 'extension_not_found' ? 404 : 409 };
  }
  const definition = hidden.definitions.find((candidate) => candidate.entity === entity);
  if (!definition) {
    return { problem: 'entity_type_not_found', status: 404 };
  }
  const repository = (hidden.repos as unknown as Record<string, Repository>)[definition.key] as Repository;
  if (await repository.get(entityId) === undefined) {
    return { problem: 'entity_not_found', status: 404 };
  }
  if (await isConnected(hidden.db, workspace.id, entity, entityId)) {
    return { problem: 'hidden_entity_connected', status: 409 };
  }
  return { db: hidden.db, repository, hidden, definition };
}
