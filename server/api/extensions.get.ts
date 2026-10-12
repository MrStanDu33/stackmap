import { lucideIconExists } from '@stackmap/extension-sdk';

import { listExtensions } from '../../shared/contracts/extensions';
import { defineContractHandler } from '../utils/contract-handler';
import { useExtensionRegistry } from '../utils/extensions';

import type { ExtensionManifest, KindEntity } from '@stackmap/extension-sdk';

const warned = new Set<string>();

/** The icon, unless it names a Lucide icon the app does not bundle: the client then shows its fallback icon. */
const knownIcon = (icon: string | undefined, owner: string) => {
  if (icon?.startsWith('i-lucide-') && !lucideIconExists(icon)) {
    if (!warned.has(icon)) {
      warned.add(icon);
      console.warn(`[extensions] ${owner} uses the icon ${icon}, which Lucide does not have; showing the fallback icon`);
    }
    return {};
  }
  return icon === undefined ? {} : { icon };
};

const kindsOf = (extension: ExtensionManifest, entity: KindEntity) =>
  (extension.contributes.kinds[entity] ?? []).map(({ id, label, icon }) => ({
    id,
    label,
    ...knownIcon(icon, `"${extension.id}"`),
  }));

const toExtension = (extension: ExtensionManifest) => ({
  id: extension.id,
  version: extension.version,
  name: extension.name,
  description: extension.description,
  ...knownIcon(extension.icon, `"${extension.id}"`),
  alwaysOn: extension.alwaysOn,
  dependsOn: [...extension.dependsOn],
  // Per-workspace toggles arrive with phase 5; until then every installed extension is on.
  enabled: true,
  kinds: {
    host: kindsOf(extension, 'host'),
    network: kindsOf(extension, 'network'),
    service: kindsOf(extension, 'service'),
    protocol: kindsOf(extension, 'protocol'),
  },
});

export default defineContractHandler(listExtensions, () => ({
  status: 200,
  body: { extensions: useExtensionRegistry().extensions.map(toExtension) },
}));
