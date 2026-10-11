import { getOpenApiDocument } from '../../shared/contracts/system';
import { defineContractHandler } from '../utils/contract-handler';

export default defineContractHandler(getOpenApiDocument, () => {
  throw new Error('Not implemented');
});
