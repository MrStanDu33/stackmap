import { createInvitation } from '../../../../../shared/contracts/invitations';
import { defineContractHandler } from '../../../../utils/contract-handler';

export default defineContractHandler(createInvitation, () => {
  throw new Error('Not implemented');
});
