import { getSession } from '../../shared/contracts/auth';
import { defineContractHandler } from '../utils/contract-handler';

export default defineContractHandler(getSession, () => {
  throw new Error('Not implemented');
});
