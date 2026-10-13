import { flattenMessages } from './locales';
import { KIND_ENTITIES, lucideIconExists } from './manifest';

import type { Messages } from './locales';
import type { ExtensionManifest } from './manifest';

export type { Messages } from './locales';

export interface ExtensionFiles {
  /** The extension's locale files, by locale code. */
  messages: Readonly<Record<string, Messages>>;
  /** Files of the extension's public/ directory, relative to it (`extensions/<id>/icon.svg`). */
  publicFiles: readonly string[];
  /** English messages of the app and the other extensions, to check a locale pack's placeholders. */
  reference?: Messages;
}

/** Every built-in extension is translated into the app's locales. */
const REQUIRED_LOCALES = ['en', 'fr'];

const PLACEHOLDER = /\{\s*(\w+)\s*\}/g;

/** `{count} {total}`, sorted, or "no placeholder". */
const placeholdersOf = (message: string) => {
  const names = [...new Set([...message.matchAll(PLACEHOLDER)].map(([, name]) => `{${name ?? ''}}`))].sort();
  return names.length > 0 ? names.join(' ') : 'no placeholder';
};

const kindsOf = (manifest: ExtensionManifest) =>
  KIND_ENTITIES.flatMap((entity) => manifest.contributes.kinds[entity] ?? []);

/**
 * Checks what a manifest refers to: its strings in English and French, the placeholders of every translation, its
 * files and its icons. Returns the problems found. In a language the extension adds (a locale pack), it may translate
 * any key, and missing keys are coverage (they fall back to English), not problems.
 */
export function checkExtension(
  manifest: ExtensionManifest,
  { messages, publicFiles, reference = {} }: ExtensionFiles,
): string[] {
  // A set: a key missing from a locale is reported once, whether the manifest or another locale uses it.
  const problems = new Set<string>();
  const keyPrefix = `extensions.${manifest.id}.`;
  const contributed = new Set(manifest.contributes.locales?.map(({ code }) => code));

  for (const locale of REQUIRED_LOCALES.filter((code) => !(code in messages))) {
    problems.add(`${locale} messages are missing`);
  }

  const locales = new Map(Object.entries(messages).map(([locale, tree]) => [locale, flattenMessages(tree)]));
  // The extension's own keys must be in each of its non-contributed languages, so these stay complete.
  const ownKeys = new Set([
    manifest.name,
    manifest.description,
    ...kindsOf(manifest).map(({ label }) => label),
    ...(manifest.contributes.entities ?? []).map(({ label }) => label),
    ...[...locales]
      .filter(([locale]) => !contributed.has(locale))
      .flatMap(([, flat]) => [...flat.keys()].filter((key) => key.startsWith(keyPrefix))),
  ]);
  const english = new Map([...flattenMessages(reference), ...(locales.get('en') ?? [])]);
  for (const [locale, flat] of locales) {
    const isPack = contributed.has(locale);
    for (const key of isPack ? [] : ownKeys) {
      if (!flat.has(key)) {
        problems.add(`${key} is missing in ${locale}`);
      }
    }
    for (const [key, message] of flat) {
      if (message.trim() === '') {
        problems.add(`${key} is empty in ${locale}`);
      }
      // Layers share one namespace: outside the languages it adds, an extension keeps to its own keys.
      if (!isPack && !key.startsWith(keyPrefix)) {
        problems.add(`${key} is outside ${keyPrefix}`);
      }
      const source = english.get(key);
      if (locale !== 'en' && source !== undefined && placeholdersOf(message) !== placeholdersOf(source)) {
        problems.add(`${key} has ${placeholdersOf(message)} in ${locale} but ${placeholdersOf(source)} in English`);
      }
    }
  }

  // An extension keeps to its own files too, so it cannot override another's.
  for (const file of publicFiles) {
    if (!file.startsWith(`extensions/${manifest.id}/`)) {
      problems.add(`public/${file} is outside public/extensions/${manifest.id}/`);
    }
  }

  const icons = [manifest.icon, ...kindsOf(manifest).map(({ icon }) => icon)].filter((icon) => icon !== undefined);
  for (const icon of icons) {
    if (icon.startsWith('i-lucide-')) {
      if (!lucideIconExists(icon)) {
        problems.add(`icon ${icon} does not exist in Lucide`);
      }
    } else if (!publicFiles.includes(icon.slice(1))) {
      problems.add(`icon ${icon} is missing from public/`);
    }
  }

  return [...problems];
}
