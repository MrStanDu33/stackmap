import type { ExtensionManifest } from './manifest';

/**
 * Hooks the app calls on the server. Extensions add theirs, named `<id>:<name>`, with
 * `declare module '@stackmap/extension-sdk' { interface ServerHooks { … } }`. Payloads are plain JSON.
 */
export interface ServerHooks {
  'app:ready': { version: string };
  'app:close': Record<string, never>;
}

/** Hooks the app calls in the browser; extended like ServerHooks. */
export interface ClientHooks {
  'app:mounted': Record<string, never>;
  'route:changed': { path: string };
  'locale:changed': { locale: string };
}

export type HookHandlers<H> = { [K in keyof H]?: (payload: H[K]) => void | Promise<void> };

export interface ExtensionLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string, error?: unknown) => void;
}

export interface InstalledExtension {
  id: string;
  version: string;
  state: 'active' | 'failed';
}

/** What an extension's code gets from the app. */
export interface ExtensionContext<H> {
  /** Every installed extension, with its state. */
  extensions: readonly InstalledExtension[];
  /** Calls one of the extension's own declared hooks. */
  callHook: <K extends keyof H & string>(name: K, payload: H[K]) => Promise<void>;
  /** Logs prefixed with the extension's id. */
  log: ExtensionLogger;
}

export interface ExtensionServer {
  extension: string;
  setup?: (context: ExtensionContext<ServerHooks>) => void | Promise<void>;
  hooks: HookHandlers<ServerHooks>;
}

export interface ExtensionClient {
  extension: string;
  hooks: HookHandlers<ClientHooks>;
}

export interface HookRegistration<H> {
  extension: string;
  hooks: HookHandlers<H>;
}

export interface HookBusOptions {
  onError: (error: unknown, context: { extension: string; hook: string }) => void;
  /** Called with one line per hook call when tracing is on. */
  trace?: (line: string) => void;
  /** Fail calls whose payload is not plain JSON (on outside production). */
  checkPayloads?: boolean;
  /** How long a handler may take before it counts as failed; the bus stops waiting for it (it cannot be cancelled). */
  timeoutMs?: number;
}

export interface HookBus<H> {
  callHook: <K extends keyof H & string>(name: K, payload: H[K]) => Promise<void>;
  /** Ids of the extensions handling a hook, in call order. */
  handlersOf: (name: keyof H & string) => string[];
}

/** The hook names the app itself calls; extension hooks are named `<id>:<name>`. */
export const CORE_SERVER_HOOKS: readonly (keyof ServerHooks)[] = ['app:ready', 'app:close'];
export const CORE_CLIENT_HOOKS: readonly (keyof ClientHooks)[] = ['app:mounted', 'route:changed', 'locale:changed'];

/** Ties an extension's server code to its manifest. */
export function defineExtensionServer(
  manifest: ExtensionManifest,
  { setup, hooks = {} }: Omit<ExtensionServer, 'extension' | 'hooks'> & { hooks?: HookHandlers<ServerHooks> },
): ExtensionServer {
  // A frozen copy: an extension cannot add handlers after the app checked which hooks it may handle.
  return { extension: manifest.id, ...(setup ? { setup } : {}), hooks: Object.freeze({ ...hooks }) };
}

/** Ties an extension's browser code to its manifest. */
export function defineExtensionClient(
  manifest: ExtensionManifest,
  { hooks = {} }: { hooks?: HookHandlers<ClientHooks> },
): ExtensionClient {
  return { extension: manifest.id, hooks: Object.freeze({ ...hooks }) };
}

/** Settles like `work`, or rejects with "timed out after N ms"; the work itself cannot be cancelled. */
export async function withTimeout<T>(work: Promise<T>, timeoutMs: number | undefined): Promise<T> {
  if (timeoutMs === undefined) {
    return work;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`timed out after ${String(timeoutMs)} ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Plain JSON, which can cross to another process unchanged: no dates, functions, class instances, undefined values
 * or cycles.
 */
const isPlainJson = (value: unknown, ancestors = new WeakSet<object>()): boolean => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value !== 'object' || ancestors.has(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  ancestors.add(value);
  const plain = Object.values(value).every((item) => isPlainJson(item, ancestors));
  ancestors.delete(value);
  return plain;
};

const since = (start: number) => `${(performance.now() - start).toFixed(1)}ms`;

/** Calls hooks on the registered extensions, in order, isolating each handler's failure. */
export function createHookBus<H>(
  registrations: readonly HookRegistration<H>[],
  { onError, trace, checkPayloads = false, timeoutMs }: HookBusOptions,
): HookBus<H> {
  const handlersOf = (name: keyof H & string) =>
    registrations.filter(({ hooks }) => hooks[name] !== undefined).map(({ extension }) => extension);

  return {
    handlersOf,
    callHook: async (name, payload) => {
      if (checkPayloads && !isPlainJson(payload)) {
        throw new TypeError(`The payload of "${name}" is not plain JSON: hooks pass JSON data only, `
          + 'without dates, functions, class instances, undefined values or cycles.');
      }
      const steps: string[] = [];
      for (const { extension, hooks } of registrations) {
        const handler = hooks[name];
        if (!handler) {
          continue;
        }
        const start = performance.now();
        try {
          // A copy per handler: one handler cannot change what the next one sees.
          await withTimeout(Promise.resolve(handler(structuredClone(payload))), timeoutMs);
          steps.push(`${extension} (${since(start)})`);
        } catch (error) {
          onError(error, { extension, hook: name });
          steps.push(`${extension} (${since(start)}, failed: ${error instanceof Error ? error.message : String(error)})`);
        }
      }
      trace?.(`${name} → ${steps.length > 0 ? steps.join(', ') : 'no handler'}`);
    },
  };
}
