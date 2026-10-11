import { getHealth } from '../../shared/contracts/system';
import { defineContractHandler } from '../utils/contract-handler';

export default defineContractHandler(getHealth, () => {
  throw new Error('Not implemented');
});
