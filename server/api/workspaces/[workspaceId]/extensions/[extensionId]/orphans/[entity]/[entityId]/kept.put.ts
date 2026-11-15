import { keepHiddenOrphan } from '../../../../../../../../../shared/contracts/extensions';
import { defineContractHandler } from '../../../../../../../../utils/contract-handler';

export default defineContractHandler(keepHiddenOrphan, () => {
  throw new Error('Not implemented');
});
