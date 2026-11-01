import { getRequestURL } from 'h3';

import { problemOf } from '../../../../../shared/contracts/errors';
import { updateMember } from '../../../../../shared/contracts/members';
import { setMemberRole } from '../../../../repositories/members';
import { defineContractHandler } from '../../../../utils/contract-handler';
import { useDatabase } from '../../../../utils/database';

/**
 * Changes a member's role as the caller's own role allows, checked on the member's role as read under the
 * workspace's lock, never leaving the workspace without an owner.
 */
export default defineContractHandler(updateMember, async ({ params: { userId }, body: { role }, workspace }, event) => {
  const instance = getRequestURL(event).pathname;
  const changed = await setMemberRole(await useDatabase(), workspace.id, userId, role, { actor: workspace.role });
  if (changed === 'member_not_found') {
    return { status: 404, body: problemOf('member_not_found', { detail: 'No member with this id in the workspace.', instance }) };
  }
  if (changed === 'forbidden') {
    return { status: 403, body: problemOf('forbidden', { detail: `A ${workspace.role} cannot give this member the ${role} role.`, instance }) };
  }
  if (changed === 'last_owner') {
    return { status: 409, body: problemOf('last_owner', { detail: 'A workspace needs at least one owner.', instance }) };
  }
  return { status: 200, body: { ...changed, joinedAt: changed.joinedAt.toISOString() } };
});
