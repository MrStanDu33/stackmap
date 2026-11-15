import { getRequestURL } from 'h3';

import { problemOf } from '../../../../../shared/contracts/errors';
import { setExtensionEnabled } from '../../../../../shared/contracts/extensions';
import { setExtensionsEnabled } from '../../../../repositories/workspace-extensions';
import { defineContractHandler } from '../../../../utils/contract-handler';
import { useDatabase } from '../../../../utils/database';
import { toggleIn } from '../../../../utils/extensions';

/** Shared with the impact route: the same refusals. */
export const DETAILS = {
  extension_not_found: 'No installed extension has this id.',
  extension_always_on: 'This extension cannot be turned off.',
} as const;

export default defineContractHandler(setExtensionEnabled, async ({ params, body, workspace, session }, event) => {
  const db = await useDatabase();
  const toggle = await toggleIn(db, workspace.id, params.extensionId, body.enabled);
  if ('problem' in toggle) {
    const instance = getRequestURL(event).pathname;
    const problem = problemOf(toggle.problem, { detail: DETAILS[toggle.problem], instance });
    return toggle.problem === 'extension_not_found' ? { status: 404, body: problem } : { status: 409, body: problem };
  }
  await setExtensionsEnabled(db, workspace.id, toggle.changes.map(({ id }) => id), body.enabled, session.user.id);
  return { status: 200, body: { changed: toggle.changes } };
});
