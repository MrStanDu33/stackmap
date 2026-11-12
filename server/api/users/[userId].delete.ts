import { getRequestURL } from 'h3';

import { removeUser } from '../../../shared/contracts/users';
import { removeAccount } from '../../repositories/users';
import { defineContractHandler } from '../../utils/contract-handler';
import { useDatabase } from '../../utils/database';
import { refusal } from '../../utils/user-refusals';

/** Removes an account with its sessions and memberships: never the caller, nor a workspace's only owner. */
export default defineContractHandler(removeUser, async ({ params: { userId }, session }, event) => {
  const removed = await removeAccount(await useDatabase(), userId, { actorId: session.user.id });
  if ('code' in removed) {
    return refusal(removed, getRequestURL(event).pathname);
  }
  return { status: 204, body: null };
});
