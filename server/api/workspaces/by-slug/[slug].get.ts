import { getWorkspaceBySlug } from '../../../../shared/contracts/workspaces';
import { defineContractHandler } from '../../../utils/contract-handler';

export default defineContractHandler(getWorkspaceBySlug, () => {
  throw new Error('Not implemented');
});
