import type { InstalledExtension } from '../extensions/inventory';
import type { Translate } from '../utils/traffic-graph';
import type { KindEntity } from '@stackmap/extension-sdk';

export interface KindOption {
  value: string;
  label: string;
  icon?: string;
}

export interface ExtensionLabels {
  /** A kind's translated name, or its id when no active extension declares it. */
  kindLabel: (entity: KindEntity, kind: string) => string;
  /** The kinds of an entity across the active extensions, translated, for a select. */
  kindOptions: (entity: KindEntity) => KindOption[];
  entityLabel: (extension: string, entity: string) => string;
  entityPlural: (extension: string, entity: string) => string;
  extensionName: (extension: string) => string;
}

/** Labels from the installed extensions, translated when called: they follow the locale. */
export function extensionLabels(_extensions: readonly InstalledExtension[], _t: Translate): ExtensionLabels {
  throw new Error('Not implemented');
}

/**
 * The installed extensions, fetched once on the client and shared under the `extensions` state, which components
 * read through `useExtensionLabels`.
 */
export function useExtensions(): void {
  // Filled in by the implementation.
}

/** The labels of the installed extensions in the current language; raw ids until the extensions are loaded. */
export function useExtensionLabels(): ExtensionLabels {
  throw new Error('Not implemented');
}
