import type { ExtensionRegistry } from './registry';
import type { HookBus, ServerHooks } from '@stackmap/extension-sdk';

export type ExtensionRuntime = HookBus<ServerHooks>;

/**
 * Starts the active extensions' server code: checks the hooks each one handles, runs their `setup` in registry order
 * (a failing one is marked failed with its dependents) and builds the hook bus.
 */
export function startExtensions(_registry: ExtensionRegistry): Promise<ExtensionRuntime> {
  throw new Error('Not implemented');
}
