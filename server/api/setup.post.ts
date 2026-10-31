import { setUp } from '../../shared/contracts/auth';
import { defineContractHandler } from '../utils/contract-handler';

export default defineContractHandler(setUp, () => {
  throw new Error('Not implemented');
});
