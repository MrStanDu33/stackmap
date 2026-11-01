import { listMembers } from '../../../../../shared/contracts/members';
import { defineContractHandler } from '../../../../utils/contract-handler';

export default defineContractHandler(listMembers, () => {
  throw new Error('Not implemented');
});
