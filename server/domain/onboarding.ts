import { ExtensionNotFoundError } from './extension-toggles';

import type { ToggledExtension } from './extension-toggles';

/**
 * Which optional extensions a workspace's onboarding turns on and off, in registry order: those chosen and everything
 * they need on, every other one off. Always-on extensions are left out.
 */
export function onboardingChange(
  installed: readonly ToggledExtension[],
  chosen: readonly string[],
): { enable: string[]; disable: string[] } {
  const byId = new Map(installed.map((extension) => [extension.id, extension]));
  const on = new Set<string>();
  const queue = [...chosen];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    const extension = byId.get(id);
    if (!extension) {
      throw new ExtensionNotFoundError(`No installed extension has the id "${id}".`);
    }
    if (!on.has(id)) {
      on.add(id);
      queue.push(...extension.dependsOn);
    }
  }
  const optional = installed.filter(({ alwaysOn }) => !alwaysOn).map(({ id }) => id);
  return { enable: optional.filter((id) => on.has(id)), disable: optional.filter((id) => !on.has(id)) };
}
