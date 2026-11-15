import { listWorkspaceExtensions } from '../../../../../shared/contracts/extensions';
import { extensionStates } from '../../../../repositories/workspace-extensions';
import { defineContractHandler } from '../../../../utils/contract-handler';
import { useDatabase } from '../../../../utils/database';
import { useExtensionRegistry } from '../../../../utils/extensions';
import { toExtension } from '../../../extensions.get';

export default defineContractHandler(listWorkspaceExtensions, async ({ workspace }) => {
  const { extensions } = useExtensionRegistry();
  const ids = extensions.map(({ manifest }) => manifest.id);
  const states = await extensionStates(await useDatabase(), workspace.id, ids);
  return {
    status: 200,
    body: {
      extensions: extensions.map((extension) => ({
        ...toExtension(extension),
        enabled: extension.manifest.alwaysOn || (states.get(extension.manifest.id) ?? true),
      })),
    },
  };
});
