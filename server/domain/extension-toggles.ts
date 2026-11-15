import type { ExtensionManifest } from '@stackmap/extension-sdk';

/** What the toggles need to know of an installed extension. */
export type ToggledExtension = Pick<ExtensionManifest, 'id' | 'alwaysOn' | 'dependsOn'>;

/** An extension turned on or off. */
export interface ExtensionChange {
  id: string;
  enabled: boolean;
}

/** The id names no installed extension. */
export class ExtensionNotFoundError extends Error {
  override name = 'ExtensionNotFoundError';
}

/** The extension is always on: it cannot be turned off. */
export class ExtensionAlwaysOnError extends Error {
  override name = 'ExtensionAlwaysOnError';
}

/**
 * The extensions that change when one is turned on or off in a workspace: its enabled dependents going off with it,
 * or its disabled dependencies coming on with it; the asked one first, then in registry order.
 */
export function toggleChange(
  installed: readonly ToggledExtension[],
  disabled: ReadonlySet<string>,
  id: string,
  enabled: boolean,
): ExtensionChange[] {
  const asked = installed.find((extension) => extension.id === id);
  if (!asked) {
    throw new ExtensionNotFoundError(`No installed extension has the id "${id}".`);
  }
  if (asked.alwaysOn) {
    if (!enabled) {
      throw new ExtensionAlwaysOnError(`The ${id} extension cannot be turned off.`);
    }
    return [];
  }
  // Off: everything that needs it, transitively. On: everything it needs, transitively.
  const linked = (extension: ToggledExtension) => (enabled
    ? installed.filter(({ id: other }) => extension.dependsOn.includes(other))
    : installed.filter(({ dependsOn }) => dependsOn.includes(extension.id)));
  const reached = new Set<string>([id]);
  for (const queue = [asked]; queue.length > 0;) {
    for (const next of linked(queue.shift() as ToggledExtension).filter(({ id: other }) => !reached.has(other))) {
      reached.add(next.id);
      queue.push(next);
    }
  }
  const changes = (other: string) => !installed.find((extension) => extension.id === other)?.alwaysOn
    && disabled.has(other) === enabled;
  const rest = installed
    .filter((extension) => extension.id !== id && reached.has(extension.id) && changes(extension.id));
  return [...(changes(id) ? [{ id, enabled }] : []), ...rest.map((extension) => ({ id: extension.id, enabled }))];
}
