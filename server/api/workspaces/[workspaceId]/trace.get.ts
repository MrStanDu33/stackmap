import { getRequestURL } from 'h3';

import { problemOf } from '../../../../shared/contracts/errors';
import { getTrace } from '../../../../shared/contracts/traces';
import { loggerFor } from '../../../extensions/runtime';
import { createWorkspaceRepositories } from '../../../repositories';
import { traceWorkspace } from '../../../repositories/traces';
import { getWorkspace } from '../../../repositories/workspaces';
import { defineContractHandler } from '../../../utils/contract-handler';
import { useDatabase } from '../../../utils/database';
import { useExtensionRegistry } from '../../../utils/extensions';

export default defineContractHandler(getTrace, async ({ params: { workspaceId }, query }, event) => {
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
  const trace = await traceWorkspace(
    { db, repos, workspaceId },
    { hostname: query.hostname, port: query.port ?? null, client: query.client },
    { resolvers: registry.traceHopResolvers(), logger: loggerFor },
  );
  return { status: 200, body: trace };
});
