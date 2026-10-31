import { signIn } from '../../shared/contracts/auth';
import { defineContractHandler } from '../utils/contract-handler';

export default defineContractHandler(signIn, () => {
  throw new Error('Not implemented');
});
