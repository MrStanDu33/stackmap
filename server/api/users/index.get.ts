import { listUsers as listUsersContract } from '../../../shared/contracts/users';
import { listUsers } from '../../repositories/users';
import { defineContractHandler } from '../../utils/contract-handler';
import { useDatabase } from '../../utils/database';

/** Every account, for the instance administrator's users page. */
export default defineContractHandler(listUsersContract, async () =>
  ({ status: 200, body: { users: await listUsers(await useDatabase()) } }));
