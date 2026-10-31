import type { ExtensionRegistry } from '../extensions/registry';
import type { ExtensionRuntime } from '../extensions/runtime';

let registry: ExtensionRegistry | undefined;
let runtime: Promise<ExtensionRuntime> | undefined;

const PLUGIN = 'server/plugins/00.extensions.ts';

/** Called once by the startup plugin. */
export function setExtensionRegistry(built: ExtensionRegistry): void {
  registry = built;
}

/** Called once by the startup plugin, with the extensions being started. */
export function setExtensionRuntime(starting: Promise<ExtensionRuntime>): void {
  runtime = starting;
}

/** The registry of the installed extensions, built by the startup plugin. */
export function useExtensionRegistry(): ExtensionRegistry {
  if (!registry) {
    throw new Error(`The extension registry is not ready: the startup plugin (${PLUGIN}) has not run.`);
  }
  return registry;
}

/** Calls hooks on the active extensions, once they have started. */
export function useExtensionHooks(): Pick<ExtensionRuntime, 'callHook'> {
  const starting = runtime;
  if (!starting) {
    throw new Error(`The extensions are not ready: the startup plugin (${PLUGIN}) has not run.`);
  }
  return {
    callHook: async (name, payload) => {
      await (await starting).callHook(name, payload);
    },
  };
}

/** Resolves once the extensions' tables exist and their setup ran. */
export function whenExtensionsStarted(): Promise<void> {
  return Promise.reject(new Error('Not implemented'));
}
