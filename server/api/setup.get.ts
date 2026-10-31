import { getSetup } from '../../shared/contracts/auth';
import { defineContractHandler } from '../utils/contract-handler';

export default defineContractHandler(getSetup, () => {
  throw new Error('Not implemented');
});
