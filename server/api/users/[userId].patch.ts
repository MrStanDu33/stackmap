import { getRequestURL } from 'h3';

import { updateUser } from '../../../shared/contracts/users';
import { setInstanceRole } from '../../repositories/users';
import { defineContractHandler } from '../../utils/contract-handler';
import { useDatabase } from '../../utils/database';
import { refusal } from '../../utils/user-refusals';

/** Promotes or demotes an account, never the caller and never the last administrator; read on its next request. */
export default defineContractHandler(updateUser, async ({ params: { userId }, body: { role }, session }, event) => {
  const changed = await setInstanceRole(await useDatabase(), userId, role, { actorId: session.user.id });
  if ('code' in changed) {
    return refusal(changed, getRequestURL(event).pathname);
  }
  return { status: 200, body: changed };
});
