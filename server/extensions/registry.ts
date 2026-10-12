import type { ExtensionManifest, ExtensionServer, Kind, KindEntity, LocaleDeclaration } from '@stackmap/extension-sdk';

export interface RegisteredKind extends Kind {
  /** Id of the extension that contributes it. */
  extension: string;
}

export interface RegisteredLocale extends LocaleDeclaration {
  extension: string;
}

export type ExtensionState = 'active' | 'failed';

export interface RegisteredExtension {
  manifest: ExtensionManifest;
  state: ExtensionState;
  /** Why it failed, for logs and diagnostics. */
  errors: readonly string[];
  server?: ExtensionServer;
}

/** The installed extensions, checked against each other. */
export interface ExtensionRegistry {
  /** Every installed extension, dependencies first, then by id; failed ones included. */
  extensions: readonly RegisteredExtension[];
  /** The active extensions' manifests, in registry order. */
  active: readonly ExtensionManifest[];
  get: (id: string) => RegisteredExtension | undefined;
  /** Kinds of the active extensions. */
  kinds: (entity: KindEntity) => readonly RegisteredKind[];
  hasKind: (entity: KindEntity, id: string) => boolean;
  /** Languages the active extensions add. */
  locales: () => readonly RegisteredLocale[];
  /** Marks an extension failed at runtime (its setup threw), with its dependents. Throws for an always-on one. */
  fail: (id: string, error: string) => void;
}

export interface ExtensionRegistryOptions {
  /** Server code of the extensions that ship some. */
  servers?: readonly ExtensionServer[];
  /** The app's own languages, which locale packs must declare the same way. */
  appLocales?: readonly LocaleDeclaration[];
}

/** Thrown when an always-on extension (the core) fails: the app cannot run without it. */
export class ExtensionRegistryError extends Error {
  override name = 'ExtensionRegistryError';

  constructor(readonly problems: readonly string[]) {
    super(`The installed extensions do not fit together:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
  }
}

/** Checks the installed extensions against each other: those that do not fit are marked failed. */
export function createExtensionRegistry(
  _manifests: readonly ExtensionManifest[],
  _options: ExtensionRegistryOptions = {},
): ExtensionRegistry {
  throw new Error('Not implemented');
}
