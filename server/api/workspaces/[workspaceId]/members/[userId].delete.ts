import { getRequestURL } from 'h3';

import { problemOf } from '../../../../../shared/contracts/errors';
import { removeMember } from '../../../../../shared/contracts/members';
import { canManage } from '../../../../domain/member-rules';
import { removeMember as remove, roleIn } from '../../../../repositories/members';
import { defineContractHandler } from '../../../../utils/contract-handler';
import { useDatabase } from '../../../../utils/database';

/** Removes a member as the caller's own role allows, or the caller themselves; never the last owner. */
export default defineContractHandler(removeMember, async ({ params: { userId }, session, workspace }, event) => {
  const db = await useDatabase();
  const instance = getRequestURL(event).pathname;
  const notMember = { status: 404 as const, body: problemOf('member_not_found', { detail: 'No member with this id in the workspace.', instance }) };
  const current = await roleIn(db, userId, workspace.id);
  if (!current) {
    return notMember;
  }
  if (userId !== session.user.id && !canManage(workspace.role, current)) {
    return { status: 403, body: problemOf('forbidden', { detail: `A ${workspace.role} cannot remove a ${current}.`, instance }) };
  }
  const removed = await remove(db, workspace.id, userId);
  if (removed === 'member_not_found') {
    return notMember;
  }
  if (removed === 'last_owner') {
    return { status: 409, body: problemOf('last_owner', { detail: 'A workspace needs at least one owner.', instance }) };
  }
  return { status: 204, body: null };
});
