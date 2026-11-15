import { listHiddenOrphans } from '../../../../../../../shared/contracts/extensions';
import { defineContractHandler } from '../../../../../../utils/contract-handler';

export default defineContractHandler(listHiddenOrphans, () => {
  throw new Error('Not implemented');
});
