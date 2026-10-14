import { CORE_SERVER_HOOKS, createHookBus, RESERVED_EXTENSION_IDS, withTimeout } from '@stackmap/extension-sdk';

import type { ExtensionRegistry, RegisteredExtension } from './registry';
import type {
  ExtensionContext, ExtensionLogger, ExtensionManifest, HookBus, ServerHooks,
} from '@stackmap/extension-sdk';

export type ExtensionRuntime = HookBus<ServerHooks>;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The defaults: a setup that hangs fails its extension; a hook handler that hangs counts as failed. */
export const SETUP_TIMEOUT_MS = 30_000;
export const HOOK_TIMEOUT_MS = 10_000;

/**
 * Masks credentials in an error kept for diagnostics (the logs keep the full message): passwords in URLs and secret
 * query parameters.
 */
export const maskSecrets = (message: string) => message
  .replace(/(\b[a-z][\w+.-]*:\/\/[^:/\s@]+:)[^@\s]+@/gi, '$1***@')
  .replace(/\b(password|passwd|pwd|secret|token|api[_-]?key)=[^&\s]+/gi, '$1=***');

/** `<extension id>:<name>`, exactly. */
const splitHook = (hook: string) => {
  const parts = hook.split(':');
  return parts.length === 2 ? { owner: parts[0] ?? '', name: parts[1] ?? '' } : undefined;
};

const loggerFor = (id: string): ExtensionLogger => ({
  info: (message) => {
    console.info(`[extension:${id}] ${message}`);
  },
  warn: (message) => {
    console.warn(`[extension:${id}] ${message}`);
  },
  // One text entry per error, with its stack, as server logs are read as text.
  error: (message, error) => {
    const stack = error instanceof Error && error.stack ? `\n${error.stack}` : '';
    console.error(`[extension:${id}] ${message}${stack}`);
  },
});

const isCoreHook = (hook: string) => (CORE_SERVER_HOOKS as readonly string[]).includes(hook);

const declares = (manifest: ExtensionManifest, name: string) =>
  manifest.contributes.hooks?.some((hook) => hook.side === 'server' && hook.name === name) ?? false;

/** An extension may handle the app's hooks, its own, and those of the extensions it depends on or enhances. */
function hookErrors(registry: ExtensionRegistry, { manifest, server }: RegisteredExtension): string[] {
  const errors: string[] = [];
  for (const hook of Object.keys(server?.hooks ?? {}).filter((name) => !isCoreHook(name))) {
    const { owner = '', name = '' } = splitHook(hook) ?? {};
    if (name === '' || owner === '' || RESERVED_EXTENSION_IDS.includes(owner)) {
      errors.push(`handles "${hook}", which is not a Stackmap hook`);
    } else if (owner !== manifest.id && !manifest.dependsOn.includes(owner) && !manifest.enhances?.includes(owner)) {
      errors.push(`handles "${hook}" but neither depends on nor enhances "${owner}"`);
    } else {
      // An enhanced extension that is not installed declares nothing yet: its hooks are skipped until it is.
      const declarer = registry.get(owner)?.manifest;
      if (declarer && !declares(declarer, name)) {
        errors.push(`handles "${hook}", which "${owner}" does not declare`);
      }
    }
  }
  return errors;
}

/** The active extensions' handlers, without those for hooks of an enhanced extension that is missing or failed. */
function registrationsOf(registry: ExtensionRegistry) {
  const active = new Set(registry.active.map(({ id }) => id));
  return registry.extensions
    .filter(({ state, server }) => state === 'active' && server)
    .map(({ manifest, server }) => ({
      extension: manifest.id,
      hooks: Object.fromEntries(Object.entries(server?.hooks ?? {}).filter(([hook]) =>
        isCoreHook(hook) || active.has(hook.split(':')[0] ?? ''))),
    }));
}

/**
 * Starts the active extensions' server code: checks the hooks each one handles, runs their `setup` in registry order
 * (a failing one is marked failed with its dependents) and returns the hook bus.
 */
export interface ExtensionRuntimeOptions {
  /** How long a setup may take before its extension fails. */
  setupTimeoutMs?: number;
  /** How long a hook handler may take before it counts as failed. */
  hookTimeoutMs?: number;
}

export async function startExtensions(
  registry: ExtensionRegistry,
  { setupTimeoutMs = SETUP_TIMEOUT_MS, hookTimeoutMs = HOOK_TIMEOUT_MS }: ExtensionRuntimeOptions = {},
): Promise<ExtensionRuntime> {
  const trace = process.env.STACKMAP_DEBUG?.split(',').includes('extensions')
    ? (line: string) => {
        console.debug(`[extensions] ${line}`);
      }
    : undefined;
  // Built per call from the current states, so an extension that fails stops receiving hooks at once.
  const bus = () => createHookBus<ServerHooks>(registrationsOf(registry), {
    onError: (error, { extension, hook }) => {
      loggerFor(extension).error(`${hook} failed`, error);
    },
    trace,
    checkPayloads: process.env.NODE_ENV !== 'production',
    timeoutMs: hookTimeoutMs,
  });

  for (const extension of registry.extensions.filter(({ state }) => state === 'active')) {
    for (const error of hookErrors(registry, extension)) {
      loggerFor(extension.manifest.id).error(`failed: ${error}`);
      registry.fail(extension.manifest.id, error);
    }
  }

  const contextFor = (manifest: ExtensionManifest): ExtensionContext<ServerHooks> => ({
    get extensions() {
      return registry.extensions.map(({ manifest: { id, version }, state }) => ({ id, version, state }));
    },
    callHook: async (name, payload) => {
      const { owner, name: hookName = '' } = splitHook(name) ?? {};
      if (owner !== manifest.id) {
        throw new Error(`"${manifest.id}" can only call its own hooks (${manifest.id}:…), not "${name}"`);
      }
      if (!declares(manifest, hookName)) {
        throw new Error(`"${manifest.id}" does not declare "${name}" in contributes.hooks`);
      }
      await bus().callHook(name, payload);
    },
    log: loggerFor(manifest.id),
  });

  for (const { manifest, server } of registry.extensions) {
    if (registry.get(manifest.id)?.state !== 'active' || !server?.setup) {
      continue;
    }
    try {
      await withTimeout(Promise.resolve(server.setup(contextFor(manifest))), setupTimeoutMs);
    } catch (error) {
      loggerFor(manifest.id).error(`setup failed: ${messageOf(error)}`, error);
      // Throws for an always-on extension: the app cannot run without it.
      registry.fail(manifest.id, `setup failed: ${maskSecrets(messageOf(error))}`);
    }
  }

  return {
    callHook: (name, payload) => bus().callHook(name, payload),
    handlersOf: (name) => bus().handlersOf(name),
  };
}
