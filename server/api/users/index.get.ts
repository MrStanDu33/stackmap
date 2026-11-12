import { listUsers } from '../../../shared/contracts/users';
import { defineContractHandler } from '../../utils/contract-handler';

export default defineContractHandler(listUsers, () => {
  throw new Error('Not implemented');
});
