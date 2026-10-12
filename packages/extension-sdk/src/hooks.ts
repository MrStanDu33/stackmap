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
}

export interface HookBus<H> {
  callHook: <K extends keyof H & string>(name: K, payload: H[K]) => Promise<void>;
  /** Ids of the extensions handling a hook, in call order. */
  handlersOf: (name: keyof H & string) => string[];
}

/** The hook names the app itself calls; extension hooks are named `<id>:<name>`. */
export const CORE_SERVER_HOOKS: readonly (keyof ServerHooks)[] = ['app:ready', 'app:close'];
export const CORE_CLIENT_HOOKS: readonly (keyof ClientHooks)[] = ['app:mounted', 'route:changed', 'locale:changed'];

export function defineExtensionServer(
  _manifest: ExtensionManifest,
  _definition: Omit<ExtensionServer, 'extension' | 'hooks'> & { hooks?: HookHandlers<ServerHooks> },
): ExtensionServer {
  throw new Error('Not implemented');
}

export function defineExtensionClient(
  _manifest: ExtensionManifest,
  _definition: { hooks?: HookHandlers<ClientHooks> },
): ExtensionClient {
  throw new Error('Not implemented');
}

/** Calls hooks on the registered extensions, in order, isolating each handler's failure. */
export function createHookBus<H>(_registrations: readonly HookRegistration<H>[], _options: HookBusOptions): HookBus<H> {
  throw new Error('Not implemented');
}
