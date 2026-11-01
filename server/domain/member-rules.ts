import type { WorkspaceRole } from '../../shared/contracts/contract';

/**
 * Whether a member with the actor's role may manage a member with the target's role (null for someone invited) and
 * give them the granted role.
 */
export function canManage(_actor: WorkspaceRole, _target: WorkspaceRole | null, _granted?: WorkspaceRole): boolean {
  return false;
}
