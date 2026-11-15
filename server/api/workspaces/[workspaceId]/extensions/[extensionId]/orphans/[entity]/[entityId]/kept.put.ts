import { getRequestURL } from 'h3';

import { problemOf } from '../../../../../../../../../shared/contracts/errors';
import { keepHiddenOrphan } from '../../../../../../../../../shared/contracts/extensions';
import { keepHiddenEntity } from '../../../../../../../../repositories/hidden-orphans';
import { defineContractHandler } from '../../../../../../../../utils/contract-handler';
import { hiddenOrphan, orphanDetail } from '../../../../../../../../utils/hidden-orphans';

export default defineContractHandler(keepHiddenOrphan, async ({ params, workspace, session }, event) => {
  const orphan = await hiddenOrphan(workspace, params, session);
  if ('problem' in orphan) {
    const instance = getRequestURL(event).pathname;
    const body = problemOf(orphan.problem, { detail: orphanDetail(orphan.problem), instance });
    return orphan.status === 404 ? { status: 404, body } : { status: 409, body };
  }
  const { extensionId: extension, entity, entityId: id } = params;
  await keepHiddenEntity(orphan.db, workspace.id, { extension, entity, id }, session.user.id);
  return { status: 204, body: null };
});
