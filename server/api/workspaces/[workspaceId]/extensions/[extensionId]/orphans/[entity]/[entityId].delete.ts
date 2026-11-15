import { getRequestURL } from 'h3';

import { problemOf } from '../../../../../../../../shared/contracts/errors';
import { removeHiddenOrphan } from '../../../../../../../../shared/contracts/extensions';
import { EntityInUseError } from '../../../../../../../repositories/errors';
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
    // shortcut: connectedness is checked just before the removal, not in its transaction; a flow based on it created
    // in between is removed with it (derived flows are refreshed on every write), acceptable until it matters.
    await orphan.repository.remove(params.entityId);
  } catch (error) {
    if (error instanceof EntityInUseError) {
      return { status: 409, body: problemOf('entity_in_use', { detail: error.message, instance }) };
    }
    throw error;
  }
  return { status: 204, body: null };
});
