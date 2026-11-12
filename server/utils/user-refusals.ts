import { problemOf } from '../../shared/contracts/errors';

import type { UserRefusal } from '../repositories/users';

const DETAILS = {
  user_not_found: 'No account with this id.',
  cannot_demote_self: 'Administrators cannot demote themselves.',
  last_admin: 'Stackmap needs at least one administrator.',
  cannot_remove_self: 'Administrators cannot remove their own account.',
} as const;

/** The problem answering a refused account change; `last_owner` lists the workspaces for the page to name. */
export function refusal(refused: UserRefusal, instance: string) {
  const detail = refused.code === 'last_owner'
    ? `This account is the only owner of ${refused.workspaces.join(', ')}. Add another owner first.`
    : DETAILS[refused.code];
  const status = refused.code === 'user_not_found' ? 404 as const : 409 as const;
  const workspaces = refused.code === 'last_owner' ? refused.workspaces : undefined;
  return { status, body: problemOf(refused.code, { detail, instance, workspaces }) };
}
