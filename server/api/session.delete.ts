import { signOut } from '../../shared/contracts/auth';
import { defineContractHandler } from '../utils/contract-handler';

export default defineContractHandler(signOut, () => {
  throw new Error('Not implemented');
});
