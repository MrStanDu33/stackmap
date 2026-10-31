import { getTraffic } from '../../../../shared/contracts/traffic';
import { defineContractHandler } from '../../../utils/contract-handler';

export default defineContractHandler(getTraffic, () => {
  throw new Error('Not implemented');
});
