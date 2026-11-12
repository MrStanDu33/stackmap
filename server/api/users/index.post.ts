import { createUser } from '../../../shared/contracts/users';
import { defineContractHandler } from '../../utils/contract-handler';

export default defineContractHandler(createUser, () => {
  throw new Error('Not implemented');
});
