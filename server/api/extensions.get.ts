import { lucideIconExists } from '@stackmap/extension-sdk';

import { listExtensions } from '../../shared/contracts/extensions';
import { defineContractHandler } from '../utils/contract-handler';
import { useExtensionRegistry } from '../utils/extensions';

import type { RegisteredExtension } from '../extensions/registry';
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

/** A failed extension is listed with its state, but contributes nothing. */
const toExtension = ({ manifest, state }: RegisteredExtension) => {
  const contributes = state === 'active';
  const kinds = (entity: KindEntity) => (contributes ? kindsOf(manifest, entity) : []);
  return {
    id: manifest.id,
    version: manifest.version,
    name: manifest.name,
    description: manifest.description,
    ...knownIcon(manifest.icon, `"${manifest.id}"`),
    alwaysOn: manifest.alwaysOn,
    dependsOn: [...manifest.dependsOn],
    state,
    // Per-workspace toggles arrive with phase 5; until then every installed extension is on.
    enabled: true,
    kinds: { host: kinds('host'), network: kinds('network'), service: kinds('service'), protocol: kinds('protocol') },
    entities: contributes ? (manifest.contributes.entities ?? []).map(({ id, label }) => ({ id, label })) : [],
    locales: contributes ? [...(manifest.contributes.locales ?? [])] : [],
  };
};

export default defineContractHandler(listExtensions, () => ({
  status: 200,
  body: { extensions: useExtensionRegistry().extensions.map(toExtension) },
}));
