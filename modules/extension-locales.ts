import { defineNuxtModule } from 'nuxt/kit';

import type { ExtensionManifest, LocaleConflict, LocaleDeclaration, Messages } from '@stackmap/extension-sdk';

export interface ExtensionLocaleFiles {
  manifest: ExtensionManifest;
  /** The extension's `i18n/locales/<code>.json` files, by code. */
  messages: Readonly<Record<string, Messages>>;
}

export interface MergedLanguage extends LocaleDeclaration {
  messages: Messages;
  /** Share of the English keys translated, from 0 to 1. */
  coverage: number;
  missing: string[];
  conflicts: Omit<LocaleConflict, 'language'>[];
}

/**
 * Every language of the app and of its extensions (in registry order), with the messages of the app and every
 * extension merged: the key's owner wins, then registry order.
 */
export function collectExtensionLocales(_input: {
  appLocales: readonly LocaleDeclaration[];
  appMessages: Readonly<Record<string, Messages>>;
  extensions: readonly ExtensionLocaleFiles[];
}): MergedLanguage[] {
  throw new Error('Not implemented');
}

/** Merges the built-in extensions' locale files per language and registers every language with @nuxtjs/i18n. */
export default defineNuxtModule({
  meta: { name: 'stackmap-extension-locales' },
  setup() {
    // Not implemented yet.
  },
});
