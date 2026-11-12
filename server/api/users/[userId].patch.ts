import { updateUser } from '../../../shared/contracts/users';
import { defineContractHandler } from '../../utils/contract-handler';

export default defineContractHandler(updateUser, () => {
  throw new Error('Not implemented');
});
