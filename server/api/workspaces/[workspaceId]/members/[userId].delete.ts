import { getRequestURL } from 'h3';

import { problemOf } from '../../../../../shared/contracts/errors';
import { removeMember } from '../../../../../shared/contracts/members';
import { removeMember as remove } from '../../../../repositories/members';
import { defineContractHandler } from '../../../../utils/contract-handler';
import { useDatabase } from '../../../../utils/database';

/** Removes a member as the caller's own role allows, or the caller themselves; never the last owner. */
export default defineContractHandler(removeMember, async ({ params: { userId }, session, workspace }, event) => {
  const instance = getRequestURL(event).pathname;
  const removed = await remove(await useDatabase(), workspace.id, userId, {
    actor: workspace.role, self: userId === session.user.id,
  });
  if (removed === 'member_not_found') {
    return { status: 404, body: problemOf('member_not_found', { detail: 'No member with this id in the workspace.', instance }) };
  }
  if (removed === 'forbidden') {
    return { status: 403, body: problemOf('forbidden', { detail: `A ${workspace.role} cannot remove this member.`, instance }) };
  }
  if (removed === 'last_owner') {
    return { status: 409, body: problemOf('last_owner', { detail: 'A workspace needs at least one owner.', instance }) };
  }
  return { status: 204, body: null };
});
