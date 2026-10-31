import { createWorkspace } from '../../../shared/contracts/workspaces';
import { defineContractHandler } from '../../utils/contract-handler';

export default defineContractHandler(createWorkspace, () => {
  throw new Error('Not implemented');
});
