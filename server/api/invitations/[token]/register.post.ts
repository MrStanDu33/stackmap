import { registerWithInvitation } from '../../../../shared/contracts/invitations';
import { defineContractHandler } from '../../../utils/contract-handler';

export default defineContractHandler(registerWithInvitation, () => {
  throw new Error('Not implemented');
});
