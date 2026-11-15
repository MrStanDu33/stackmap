import { KIND_ENTITIES } from '@stackmap/extension-sdk';

import core from '../../extensions/core/manifest';
import nat from '../../extensions/nat/manifest';
import reverseProxy from '../../extensions/reverse-proxy/manifest';

import type { InstalledExtension, WorkspaceExtension } from '../../shared/contracts/extensions';

// The manifests only, in server/extensions/builtin.ts's order: stories load this in the browser, without server code.
const BUILTIN_EXTENSIONS = [core, reverseProxy, nat];

/**
 * The built-in extensions as a workspace lists them, all active and on: what stories and client tests read.
 */
export const INSTALLED_EXTENSIONS: readonly WorkspaceExtension[] = BUILTIN_EXTENSIONS.map((manifest) => ({
  id: manifest.id,
  version: manifest.version,
  name: manifest.name,
  description: manifest.description,
  ...(manifest.onboarding === undefined ? {} : { onboarding: manifest.onboarding }),
  ...(manifest.icon === undefined ? {} : { icon: manifest.icon }),
  alwaysOn: manifest.alwaysOn,
  dependsOn: [...manifest.dependsOn],
  state: 'active',
  enabled: true,
  kinds: Object.fromEntries(KIND_ENTITIES.map((entity) => [
    entity,
    (manifest.contributes.kinds[entity] ?? []).map(({ id, label, icon }) => ({ id, label, ...(icon ? { icon } : {}) })),
  ])) as InstalledExtension['kinds'],
  entities: (manifest.contributes.entities ?? []).map(({ id, label }) => ({ id, label })),
  locales: [...(manifest.contributes.locales ?? [])],
}));
