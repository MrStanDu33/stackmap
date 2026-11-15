import { listWorkspaceExtensions } from '../../../../../shared/contracts/extensions';
import { extensionStates } from '../../../../repositories/workspace-extensions';
import { defineContractHandler } from '../../../../utils/contract-handler';
import { useDatabase } from '../../../../utils/database';
import { useExtensionRegistry } from '../../../../utils/extensions';
import { toExtension } from '../../../extensions.get';

import type { Database } from '../../../../database/types/schema';
import type { Kysely } from 'kysely';

/** The installed extensions, each on or off in the workspace: shared with the onboarding route. */
export async function listedExtensions(db: Kysely<Database>, workspaceId: string) {
  const { extensions } = useExtensionRegistry();
  const states = await extensionStates(db, workspaceId, extensions.map(({ manifest }) => manifest.id));
  return extensions.map((extension) => ({
    ...toExtension(extension),
    enabled: extension.manifest.alwaysOn || (states.get(extension.manifest.id) ?? true),
  }));
}

export default defineContractHandler(listWorkspaceExtensions, async ({ workspace }) => ({
  status: 200,
  body: { extensions: await listedExtensions(await useDatabase(), workspace.id) },
}));
