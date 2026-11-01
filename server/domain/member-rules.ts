import type { WorkspaceRole } from '../../shared/contracts/contract';

/** The roles a workspace admin manages and grants; owners manage and grant all of them. */
const MANAGED_BY_ADMINS: ReadonlySet<WorkspaceRole> = new Set(['editor', 'viewer']);

/**
 * Whether a member with the actor's role may manage a member with the target's role (null for someone invited) and
 * give them the granted role. Leaving, which anyone may do, is not decided here.
 */
export function canManage(actor: WorkspaceRole, target: WorkspaceRole | null, granted?: WorkspaceRole): boolean {
  if (actor === 'owner') {
    return true;
  }
  return actor === 'admin'
    && (target === null || MANAGED_BY_ADMINS.has(target))
    && (granted === undefined || MANAGED_BY_ADMINS.has(granted));
}
