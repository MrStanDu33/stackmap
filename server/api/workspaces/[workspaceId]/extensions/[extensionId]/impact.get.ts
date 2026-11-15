import { getRequestURL } from 'h3';

import { problemOf } from '../../../../../../shared/contracts/errors';
import { previewExtensionToggle } from '../../../../../../shared/contracts/extensions';
import { listDerivedFlows } from '../../../../../repositories/derived-flows';
import { defineContractHandler } from '../../../../../utils/contract-handler';
import { useDatabase } from '../../../../../utils/database';
import { toggleIn, useExtensionRegistry } from '../../../../../utils/extensions';
import { workspaceRepositories } from '../../../../../utils/workspace';
import { DETAILS } from '../[extensionId].put';

type Counter = { count: (filter: object) => Promise<number> };

export default defineContractHandler(previewExtensionToggle, async ({ params, query, workspace }, event) => {
  const db = await useDatabase();
  const toggle = await toggleIn(db, workspace.id, params.extensionId, query.enabled);
  if ('problem' in toggle) {
    const instance = getRequestURL(event).pathname;
    const problem = problemOf(toggle.problem, { detail: DETAILS[toggle.problem], instance });
    return toggle.problem === 'extension_not_found' ? { status: 404, body: problem } : { status: 409, body: problem };
  }
  if (query.enabled) {
    const changes = toggle.changes.map((change) => ({ ...change, entities: [], derivedFlows: 0 }));
    return { status: 200, body: { changes } };
  }
  const repos = await workspaceRepositories(workspace) as unknown as Record<string, Counter>;
  const definitions = useExtensionRegistry().repositories();
  const derived = await listDerivedFlows(db, workspace.id, { basis: false });
  const changes = await Promise.all(toggle.changes.map(async (change) => ({
    ...change,
    // A failed extension has no active repository: nothing to count.
    entities: await Promise.all(definitions.filter(({ extension }) => extension === change.id)
      .map(async ({ entity, key }) => ({ entity, count: await (repos[key] as Counter).count({}) }))),
    derivedFlows: derived.filter(({ extension }) => extension === change.id).length,
  })));
  return { status: 200, body: { changes } };
});
