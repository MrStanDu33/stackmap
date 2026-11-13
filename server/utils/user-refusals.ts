import { problemOf } from '../../shared/contracts/errors';

import type { UserRefusal } from '../repositories/users';

const MAX_DETAIL = 2000;

const DETAILS = {
  user_not_found: 'No account with this id.',
  cannot_demote_self: 'Administrators cannot demote themselves.',
  last_admin: 'Stackmap needs at least one administrator.',
  cannot_remove_self: 'Administrators cannot remove their own account.',
} as const;

/** Names the workspaces while they fit a problem's detail (2,000 characters), and counts them otherwise. */
const soleOwnerDetail = (workspaces: string[]) => {
  const named = `This account is the only owner of ${workspaces.join(', ')}. Add another owner first.`;
  return named.length <= MAX_DETAIL
    ? named
    : `This account is the only owner of ${String(workspaces.length)} workspaces. Add another owner first.`;
};

/** The problem answering a refused account change; `last_owner` lists the workspaces for the page to name. */
export function refusal(refused: UserRefusal, instance: string) {
  const detail = refused.code === 'last_owner' ? soleOwnerDetail(refused.workspaces) : DETAILS[refused.code];
  const status = refused.code === 'user_not_found' ? 404 as const : 409 as const;
  const workspaces = refused.code === 'last_owner' ? refused.workspaces : undefined;
  return { status, body: problemOf(refused.code, { detail, instance, workspaces }) };
}
