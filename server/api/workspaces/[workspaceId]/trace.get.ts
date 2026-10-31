import { getTrace } from '../../../../shared/contracts/traces';
import { defineContractHandler } from '../../../utils/contract-handler';

export default defineContractHandler(getTrace, () => {
  throw new Error('GET /api/workspaces/:workspaceId/trace is not implemented yet.');
});
