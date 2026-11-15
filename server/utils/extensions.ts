import { ExtensionAlwaysOnError, ExtensionNotFoundError, toggleChange } from '../domain/extension-toggles';
import { disabledExtensions } from '../repositories/workspace-extensions';

import type { Database } from '../database/types/schema';
import type { ExtensionChange } from '../domain/extension-toggles';
import type { ExtensionRegistry } from '../extensions/registry';
import type { ExtensionRuntime } from '../extensions/runtime';
import type { Kysely } from 'kysely';

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
  const starting = runtime;
  if (!starting) {
    throw new Error(`The extensions are not ready: the startup plugin (${PLUGIN}) has not run.`);
  }
  return starting.then(() => undefined);
}

/**
 * What turning an extension on or off would change in a workspace, or why it cannot: `extension_not_found` for an id
 * that is not installed, `extension_always_on` for the core.
 */
export async function toggleIn(
  db: Kysely<Database>,
  workspaceId: string,
  id: string,
  enabled: boolean,
): Promise<{ changes: ExtensionChange[] } | { problem: 'extension_not_found' | 'extension_always_on' }> {
  const installed = useExtensionRegistry().extensions.map(({ manifest }) => manifest);
  try {
    return { changes: toggleChange(installed, await disabledExtensions(db, workspaceId), id, enabled) };
  } catch (error) {
    if (error instanceof ExtensionNotFoundError) {
      return { problem: 'extension_not_found' };
    }
    if (error instanceof ExtensionAlwaysOnError) {
      return { problem: 'extension_always_on' };
    }
    throw error;
  }
}
