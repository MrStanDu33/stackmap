import { removeUser } from '../../../shared/contracts/users';
import { defineContractHandler } from '../../utils/contract-handler';

export default defineContractHandler(removeUser, () => {
  throw new Error('Not implemented');
});
