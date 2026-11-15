import { getRequestURL } from 'h3';

import { listedExtensions } from './index.get';
import { problemOf } from '../../../../../shared/contracts/errors';
import { setUpWorkspaceExtensions } from '../../../../../shared/contracts/extensions';
import { ExtensionNotFoundError } from '../../../../domain/extension-toggles';
import { onboardingChange } from '../../../../domain/onboarding';
import { inTransaction } from '../../../../repositories/entity-repository';
import { setExtensionsEnabled } from '../../../../repositories/workspace-extensions';
import { defineContractHandler } from '../../../../utils/contract-handler';
import { useDatabase } from '../../../../utils/database';
import { useExtensionRegistry } from '../../../../utils/extensions';
import { workspaceRepositories } from '../../../../utils/workspace';

type Counter = { count: (filter: object) => Promise<number> };

export default defineContractHandler(setUpWorkspaceExtensions, async ({ body, workspace, session }, event) => {
  const instance = getRequestURL(event).pathname;
  const registry = useExtensionRegistry();
  let change: ReturnType<typeof onboardingChange>;
  try {
    change = onboardingChange(registry.extensions.map(({ manifest }) => manifest), body.enabled);
  } catch (error) {
    if (!(error instanceof ExtensionNotFoundError)) {
      throw error;
    }
    return {
      status: 404,
      body: problemOf('extension_not_found', { detail: 'No installed extension has this id.', instance }),
    };
  }
  const db = await useDatabase();
  const done = await inTransaction(db, async (trx) => {
    // Every extension's entities count, on or off: onboarding is for workspaces with nothing in them yet.
    const repos = await workspaceRepositories(workspace, session, trx) as unknown as Record<string, Counter>;
    for (const { key } of registry.repositories()) {
      if (await (repos[key] as Counter).count({}) > 0) {
        return false;
      }
    }
    await setExtensionsEnabled(trx, workspace.id, change.enable, true, session.user.id);
    await setExtensionsEnabled(trx, workspace.id, change.disable, false, session.user.id);
    return true;
  });
  if (!done) {
    return {
      status: 409,
      body: problemOf('workspace_not_empty', {
        detail: 'The workspace already holds entities: turn its extensions on or off one by one.',
        instance,
      }),
    };
  }
  return { status: 200, body: { extensions: await listedExtensions(db, workspace.id) } };
});
