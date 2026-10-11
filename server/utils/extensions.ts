import type { ExtensionRegistry } from '../extensions/registry';

/** Called once by the startup plugin. */
export function setExtensionRegistry(_registry: ExtensionRegistry): void {
  throw new Error('Not implemented');
}

/** The registry of the installed extensions, built by the startup plugin. */
export function useExtensionRegistry(): ExtensionRegistry {
  throw new Error('Not implemented');
}
