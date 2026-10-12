import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { localeCoverage, mergeLocaleMessages } from '@stackmap/extension-sdk';
import { defineNuxtModule } from 'nuxt/kit';

import { BUILTIN_EXTENSION_SERVERS, BUILTIN_EXTENSIONS } from '../server/extensions/builtin';
import { createExtensionRegistry } from '../server/extensions/registry';
import { APP_LOCALES } from '../shared/i18n/locales';

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
export function collectExtensionLocales({ appLocales, appMessages, extensions }: {
  appLocales: readonly LocaleDeclaration[];
  appMessages: Readonly<Record<string, Messages>>;
  extensions: readonly ExtensionLocaleFiles[];
}): MergedLanguage[] {
  const declared = new Map(appLocales.map(({ code, language, name }) => [code, { code, language, name }]));
  for (const locale of extensions.flatMap(({ manifest }) => manifest.contributes.locales ?? [])) {
    if (!declared.has(locale.code)) {
      declared.set(locale.code, locale);
    }
  }
  const merged = [...declared.values()].map((locale) => ({
    locale,
    ...mergeLocaleMessages(locale.code, [
      { extension: null, messages: appMessages[locale.code] ?? {} },
      ...extensions.map(({ manifest, messages }) => ({
        extension: manifest.id,
        messages: messages[locale.code] ?? {},
      })),
    ]),
  }));
  const english = merged.find(({ locale }) => locale.code === 'en')?.messages ?? {};
  return merged.map(({ locale, messages, conflicts }) => ({
    ...locale,
    messages,
    ...localeCoverage(english, messages),
    conflicts: conflicts.map(({ key, winner, ignored }) => ({ key, winner, ignored })),
  }));
}

const readLocales = (dir: string): Record<string, Messages> => (existsSync(dir)
  ? Object.fromEntries(readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => [file.replace(/\.json$/, ''), JSON.parse(readFileSync(join(dir, file), 'utf8')) as Messages]))
  : {});

/**
 * Merges the app's and the built-in extensions' locale files per language, writes one file per language and
 * registers every language with @nuxtjs/i18n. The translation report (coverage, missing keys, conflicts) goes to the
 * server's runtime config, for GET /api/extensions/diagnostics.
 */
export default defineNuxtModule({
  meta: { name: 'stackmap-extension-locales' },
  setup(_options, nuxt) {
    const { rootDir } = nuxt.options;
    // The extensions that can fail at build time already have; setup failures only happen at runtime.
    const registry = createExtensionRegistry(BUILTIN_EXTENSIONS, {
      servers: BUILTIN_EXTENSION_SERVERS,
      appLocales: APP_LOCALES,
    });
    const languages = collectExtensionLocales({
      appLocales: APP_LOCALES,
      appMessages: readLocales(join(rootDir, 'i18n/locales')),
      extensions: registry.active.map((manifest) => ({
        manifest,
        messages: readLocales(join(rootDir, 'extensions', manifest.id, 'i18n/locales')),
      })),
    });

    // Written now, as @nuxtjs/i18n reads them when the modules are done, and outside .nuxt/, which Nuxt clears later.
    const langDir = join(rootDir, 'node_modules/.cache/stackmap/extension-locales');
    mkdirSync(langDir, { recursive: true });
    for (const { code, messages } of languages) {
      writeFileSync(join(langDir, `${code}.json`), JSON.stringify(messages));
    }
    nuxt.hook('i18n:registerModule', (register) => {
      register({
        langDir,
        locales: languages.map(({ code, language, name }) => ({ code, language, name, file: `${code}.json` })),
      });
    });
    nuxt.options.runtimeConfig.extensionLocales = {
      languages: languages.map(({ code, language, name, coverage, missing, conflicts }) =>
        ({ code, language, name, coverage, missing, conflicts })),
    };
  },
});
