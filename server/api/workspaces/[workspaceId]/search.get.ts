import { searchWorkspace } from '../../../../shared/contracts/search';
import { searchEntities } from '../../../repositories/search-index';
import { defineContractHandler } from '../../../utils/contract-handler';
import { useDatabase } from '../../../utils/database';
import { useExtensionRegistry } from '../../../utils/extensions';
import { workspaceRepositories } from '../../../utils/workspace';

export default defineContractHandler(searchWorkspace, async ({ query, workspace, session }) => {
  const found = await searchEntities(
    { db: await useDatabase(), repos: await workspaceRepositories(workspace, session), workspaceId: workspace.id },
    useExtensionRegistry().repositories(),
    query,
  );
  return { status: 200, body: found };
});
