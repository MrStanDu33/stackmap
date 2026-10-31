import { getTrace } from '../../../../shared/contracts/traces';
import { loggerFor } from '../../../extensions/runtime';
import { createWorkspaceRepositories } from '../../../repositories';
import { traceWorkspace } from '../../../repositories/traces';
import { defineContractHandler } from '../../../utils/contract-handler';
import { useDatabase } from '../../../utils/database';
import { useExtensionRegistry } from '../../../utils/extensions';

export default defineContractHandler(getTrace, async ({ query, workspace }) => {
  const db = await useDatabase();
  const registry = useExtensionRegistry();
  // Reads only: no write, so no derived flows to refresh.
  const repos = createWorkspaceRepositories(registry.repositories())(db, {
    workspaceId: workspace.id, actorId: null, kinds: registry,
  });
  const trace = await traceWorkspace(
    { db, repos, workspaceId: workspace.id },
    { hostname: query.hostname, port: query.port ?? null, client: query.client },
    { resolvers: registry.traceHopResolvers(), logger: loggerFor },
  );
  return { status: 200, body: trace };
});
