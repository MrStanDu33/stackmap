import { getRequestURL } from 'h3';

import { problemOf } from '../../../../shared/contracts/errors';
import { getTraffic } from '../../../../shared/contracts/traffic';
import { createWorkspaceRepositories } from '../../../repositories';
import { readTraffic } from '../../../repositories/traffic';
import { getWorkspace } from '../../../repositories/workspaces';
import { defineContractHandler } from '../../../utils/contract-handler';
import { useDatabase } from '../../../utils/database';
import { useExtensionRegistry } from '../../../utils/extensions';

export default defineContractHandler(getTraffic, async ({ params: { workspaceId } }, event) => {
  const db = await useDatabase();
  if (!await getWorkspace(db, workspaceId)) {
    return {
      status: 404,
      body: problemOf('workspace_not_found', {
        detail: `No workspace ${workspaceId}.`,
        instance: getRequestURL(event).pathname,
      }),
    };
  }
  const registry = useExtensionRegistry();
  // Reads only: no write, so no derived flows to refresh.
  const repos = createWorkspaceRepositories(registry.repositories())(db, {
    workspaceId, actorId: null, kinds: registry,
  });
  return { status: 200, body: await readTraffic({ db, repos, workspaceId }) };
});
