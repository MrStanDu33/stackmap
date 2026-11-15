import { getRequestURL } from 'h3';

import { problemOf } from '../../../../../../../../shared/contracts/errors';
import { removeHiddenOrphan } from '../../../../../../../../shared/contracts/extensions';
import { EntityInUseError } from '../../../../../../../repositories/errors';
import { deleteOrphan } from '../../../../../../../repositories/hidden-orphans';
import { defineContractHandler } from '../../../../../../../utils/contract-handler';
import { hiddenOrphan, orphanDetail } from '../../../../../../../utils/hidden-orphans';

export default defineContractHandler(removeHiddenOrphan, async ({ params, workspace, session }, event) => {
  const instance = getRequestURL(event).pathname;
  const orphan = await hiddenOrphan(workspace, params, session);
  if ('problem' in orphan) {
    const body = problemOf(orphan.problem, { detail: orphanDetail(orphan.problem), instance });
    return orphan.status === 404 ? { status: 404, body } : { status: 409, body };
  }
  try {
    const { db, repos, reposFor } = orphan.hidden;
    const workspaceOf = { db, repos, reposFor, workspaceId: workspace.id };
    const result = await deleteOrphan(workspaceOf, orphan.definition, params.entityId);
    if (result !== 'deleted') {
      // Changed since the lookup: turned on, connected, or deleted meanwhile.
      const body = problemOf(result, { detail: orphanDetail(result), instance });
      return result === 'entity_not_found' ? { status: 404, body } : { status: 409, body };
    }
  } catch (error) {
    if (error instanceof EntityInUseError) {
      return { status: 409, body: problemOf('entity_in_use', { detail: error.message, instance }) };
    }
    throw error;
  }
  return { status: 204, body: null };
});
