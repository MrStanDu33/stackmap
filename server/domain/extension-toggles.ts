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
  _installed: readonly ToggledExtension[],
  _disabled: ReadonlySet<string>,
  _id: string,
  _enabled: boolean,
): ExtensionChange[] {
  return [];
}
