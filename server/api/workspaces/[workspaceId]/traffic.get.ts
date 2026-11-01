import { getTraffic } from '../../../../shared/contracts/traffic';
import { readTraffic } from '../../../repositories/traffic';
import { defineContractHandler } from '../../../utils/contract-handler';
import { useDatabase } from '../../../utils/database';
import { workspaceRepositories } from '../../../utils/workspace';

export default defineContractHandler(getTraffic, async ({ workspace }) => ({
  status: 200,
  body: await readTraffic({
    db: await useDatabase(), repos: await workspaceRepositories(workspace), workspaceId: workspace.id,
  }),
}));
