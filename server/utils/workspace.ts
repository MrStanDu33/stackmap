import type { AuthorizedWorkspace } from './contract-handler';
import type { WorkspaceRepositories } from '../repositories';

/** The repositories of a workspace the membership check authorized. */
export function workspaceRepositories(_workspace: AuthorizedWorkspace): Promise<WorkspaceRepositories> {
  throw new Error('Not implemented');
}
