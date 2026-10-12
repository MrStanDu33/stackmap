import { KIND_ENTITIES, lucideIconExists } from './manifest';

import type { ExtensionManifest } from './manifest';

export interface Messages { [key: string]: string | Messages }

export interface ExtensionFiles {
  /** The extension's locale files, by locale code. */
  messages: Readonly<Record<string, Messages>>;
  /** Files of the extension's public/ directory, relative to it (`extensions/<id>/icon.svg`). */
  publicFiles: readonly string[];
}

/** Every built-in extension is translated into the app's locales. */
const REQUIRED_LOCALES = ['en', 'fr'];

const flatten = (messages: Messages, prefix = ''): Map<string, string> => new Map(
  Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [[path, value]] : [...flatten(value, path)];
  }),
);

const kindsOf = (manifest: ExtensionManifest) =>
  KIND_ENTITIES.flatMap((entity) => manifest.contributes.kinds[entity] ?? []);

/** Checks what a manifest refers to: its strings in English and French, and its icons. Returns the problems found. */
export function checkExtension(manifest: ExtensionManifest, { messages, publicFiles }: ExtensionFiles): string[] {
  // A set: a key missing from a locale is reported once, whether the manifest or another locale uses it.
  const problems = new Set<string>();

  for (const locale of REQUIRED_LOCALES.filter((code) => !(code in messages))) {
    problems.add(`${locale} messages are missing`);
  }

  const locales = new Map(Object.entries(messages).map(([locale, tree]) => [locale, flatten(tree)]));
  const keys = new Set([
    manifest.name,
    manifest.description,
    ...kindsOf(manifest).map(({ label }) => label),
    ...[...locales.values()].flatMap((flat) => [...flat.keys()]),
  ]);
  for (const [locale, flat] of locales) {
    for (const key of keys) {
      const message = flat.get(key);
      if (message === undefined) {
        problems.add(`${key} is missing in ${locale}`);
      } else if (message.trim() === '') {
        problems.add(`${key} is empty in ${locale}`);
      }
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
