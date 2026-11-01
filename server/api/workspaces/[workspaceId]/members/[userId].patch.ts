import { getRequestURL } from 'h3';

import { problemOf } from '../../../../../shared/contracts/errors';
import { updateMember } from '../../../../../shared/contracts/members';
import { canManage } from '../../../../domain/member-rules';
import { roleIn, setMemberRole } from '../../../../repositories/members';
import { defineContractHandler } from '../../../../utils/contract-handler';
import { useDatabase } from '../../../../utils/database';

/** Changes a member's role, as the caller's own role allows, never leaving the workspace without an owner. */
export default defineContractHandler(updateMember, async ({ params: { userId }, body: { role }, workspace }, event) => {
  const db = await useDatabase();
  const instance = getRequestURL(event).pathname;
  const current = await roleIn(db, userId, workspace.id);
  if (!current) {
    return { status: 404, body: problemOf('member_not_found', { detail: 'No member with this id in the workspace.', instance }) };
  }
  if (!canManage(workspace.role, current, role)) {
    return {
      status: 403,
      body: problemOf('forbidden', { detail: `A ${workspace.role} cannot make a ${current} ${role}.`, instance }),
    };
  }
  const changed = await setMemberRole(db, workspace.id, userId, role);
  if (changed === 'member_not_found') {
    return { status: 404, body: problemOf('member_not_found', { detail: 'No member with this id in the workspace.', instance }) };
  }
  if (changed === 'last_owner') {
    return { status: 409, body: problemOf('last_owner', { detail: 'A workspace needs at least one owner.', instance }) };
  }
  return { status: 200, body: { ...changed, joinedAt: changed.joinedAt.toISOString() } };
});
