import { setUpWorkspaceExtensions } from '../../../../../shared/contracts/extensions';
import { defineContractHandler } from '../../../../utils/contract-handler';

export default defineContractHandler(setUpWorkspaceExtensions, () => {
  throw new Error('Not implemented');
});
