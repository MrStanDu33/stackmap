import { getTraffic } from '../../../../shared/contracts/traffic';
import { createWorkspaceRepositories } from '../../../repositories';
import { readTraffic } from '../../../repositories/traffic';
import { defineContractHandler } from '../../../utils/contract-handler';
import { useDatabase } from '../../../utils/database';
import { useExtensionRegistry } from '../../../utils/extensions';

export default defineContractHandler(getTraffic, async ({ workspace }) => {
  const db = await useDatabase();
  const registry = useExtensionRegistry();
  // Reads only: no write, so no derived flows to refresh.
  const repos = createWorkspaceRepositories(registry.repositories())(db, {
    workspaceId: workspace.id, actorId: null, kinds: registry,
  });
  return { status: 200, body: await readTraffic({ db, repos, workspaceId: workspace.id }) };
});
