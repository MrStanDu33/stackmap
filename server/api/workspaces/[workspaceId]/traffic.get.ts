import { getTraffic } from '../../../../shared/contracts/traffic';
import { readTraffic } from '../../../repositories/traffic';
import { disabledExtensions } from '../../../repositories/workspace-extensions';
import { defineContractHandler } from '../../../utils/contract-handler';
import { useDatabase } from '../../../utils/database';
import { workspaceRepositories } from '../../../utils/workspace';

export default defineContractHandler(getTraffic, async ({ workspace }) => {
  const db = await useDatabase();
  return {
    status: 200,
    body: await readTraffic(
      { db, repos: await workspaceRepositories(workspace), workspaceId: workspace.id },
      { disabled: await disabledExtensions(db, workspace.id) },
    ),
  };
});
