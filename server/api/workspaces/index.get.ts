import { listWorkspaces } from '../../../shared/contracts/workspaces';
import { defineContractHandler } from '../../utils/contract-handler';

export default defineContractHandler(listWorkspaces, () => {
  throw new Error('Not implemented');
});
