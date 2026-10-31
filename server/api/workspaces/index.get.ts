import { listWorkspaces } from '../../../shared/contracts/workspaces';
import { getWorkspaceBySlug } from '../../repositories/workspaces';
import { defineContractHandler } from '../../utils/contract-handler';
import { useDatabase } from '../../utils/database';

export default defineContractHandler(listWorkspaces, async ({ query: { slug } }) => {
  const workspace = await getWorkspaceBySlug(await useDatabase(), slug);
  return {
    status: 200,
    body: {
      workspaces: workspace
        ? [{ ...workspace, createdAt: workspace.createdAt.toISOString(), updatedAt: workspace.updatedAt.toISOString() }]
        : [],
    },
  };
});
