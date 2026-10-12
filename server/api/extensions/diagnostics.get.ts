import { getExtensionDiagnostics } from '../../../shared/contracts/extensions';
import { defineContractHandler } from '../../utils/contract-handler';

export default defineContractHandler(getExtensionDiagnostics, () => {
  throw new Error('Not implemented');
});
