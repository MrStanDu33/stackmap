import type { ExtensionRegistry } from '../extensions/registry';

let registry: ExtensionRegistry | undefined;

/** Called once by the startup plugin. */
export function setExtensionRegistry(built: ExtensionRegistry): void {
  registry = built;
}

/** The registry of the installed extensions, built by the startup plugin. */
export function useExtensionRegistry(): ExtensionRegistry {
  if (!registry) {
    throw new Error('The extension registry is not ready: the startup plugin (server/plugins/extensions.ts) has not run.');
  }
  return registry;
}
