import { getTrace } from '../../../../shared/contracts/traces';
import { loggerFor } from '../../../extensions/runtime';
import { traceWorkspace } from '../../../repositories/traces';
import { disabledExtensions } from '../../../repositories/workspace-extensions';
import { defineContractHandler } from '../../../utils/contract-handler';
import { useDatabase } from '../../../utils/database';
import { useExtensionRegistry } from '../../../utils/extensions';
import { workspaceRepositories } from '../../../utils/workspace';

export default defineContractHandler(getTrace, async ({ query, workspace }) => {
  const db = await useDatabase();
  const trace = await traceWorkspace(
    { db, repos: await workspaceRepositories(workspace), workspaceId: workspace.id },
    { hostname: query.hostname, port: query.port ?? null, client: query.client },
    {
      resolvers: useExtensionRegistry().traceHopResolvers(), logger: loggerFor,
      disabled: await disabledExtensions(db, workspace.id),
    },
  );
  return { status: 200, body: trace };
});
