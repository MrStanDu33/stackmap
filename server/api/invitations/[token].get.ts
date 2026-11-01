import { getInvitation } from '../../../shared/contracts/invitations';
import { defineContractHandler } from '../../utils/contract-handler';

export default defineContractHandler(getInvitation, () => {
  throw new Error('Not implemented');
});
