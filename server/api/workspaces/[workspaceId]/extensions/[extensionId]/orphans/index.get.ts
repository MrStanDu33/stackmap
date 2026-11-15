import { getRequestURL } from 'h3';

import { problemOf } from '../../../../../../../shared/contracts/errors';
import { listHiddenOrphans } from '../../../../../../../shared/contracts/extensions';
import { listHiddenOrphans as listOrphans } from '../../../../../../repositories/hidden-orphans';
import { defineContractHandler } from '../../../../../../utils/contract-handler';
import { hiddenExtension, orphanDetail } from '../../../../../../utils/hidden-orphans';

export default defineContractHandler(listHiddenOrphans, async ({ params, workspace }, event) => {
  const hidden = await hiddenExtension(workspace, params.extensionId);
  if ('problem' in hidden) {
    const instance = getRequestURL(event).pathname;
    const body = problemOf(hidden.problem, { detail: orphanDetail(hidden.problem), instance });
    return hidden.problem === 'extension_not_found' ? { status: 404, body } : { status: 409, body };
  }
  const { db, repos, definitions } = hidden;
  return { status: 200, body: await listOrphans({ db, repos, workspaceId: workspace.id }, definitions) };
});
