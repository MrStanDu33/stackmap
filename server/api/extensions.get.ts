import { listExtensions } from '../../shared/contracts/extensions';
import { defineContractHandler } from '../utils/contract-handler';

export default defineContractHandler(listExtensions, () => {
  throw new Error('Not implemented');
});
