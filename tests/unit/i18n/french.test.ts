import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';

import i18nConfig from '../../../i18n/i18n.config';
import en from '../../../i18n/locales/en.json';
import fr from '../../../i18n/locales/fr.json';

/** Every string of a locale file, with its key. */
const strings = (messages: object, prefix = ''): [string, string][] => Object.entries(messages).flatMap(
  ([key, value]: [string, unknown]) => (typeof value === 'string'
    ? [[`${prefix}${key}`, value] as [string, string]]
    : strings(value as object, `${prefix}${key}.`)),
);

/** Spaces before : ; ! ? or straight apostrophes, outside vue-i18n literals such as {'@'}, whose quotes are syntax. */
const badTypography = (value: string) => {
  const text = value.replace(/\{'[^']*'\}/g, '');
  return / [:;!?]/.test(text) || text.includes('\'');
};

const EXTENSIONS = join(import.meta.dirname, '../../../extensions');
/** Each built-in extension's French strings, which the app merges with its own. */
const extensionLocales = readdirSync(EXTENSIONS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== 'node_modules')
  .flatMap(({ name }) => {
    try {
      return [[name, JSON.parse(readFileSync(join(EXTENSIONS, name, 'i18n/locales/fr.json'), 'utf8')) as object] as const];
    } catch {
      return [];
    }
  });

describe('French', () => {
  it('puts 0 and 1 in the singular, as French does', () => {
    const { t } = createI18n({ ...i18nConfig(), legacy: false, locale: 'fr', messages: { en, fr } }).global;
    const hosts = (count: number) => t('traffic.count.hosts', { count }, count);

    expect([hosts(0), hosts(1), hosts(2)]).toEqual(['0 hôte', '1 hôte', '2 hôtes']);
  });

  it('uses a non-breaking space before : ; ! ? and typographic apostrophes', () => {
    const wrong = strings(fr).filter(([, value]) => badTypography(value));

    expect(wrong.map(([key]) => key)).toEqual([]);
  });

  it.each(extensionLocales)('the %s extension does too (review)', (_, messages) => {
    const wrong = strings(messages).filter(([, value]) => badTypography(value));

    expect(extensionLocales.length).toBeGreaterThan(1);
    expect(wrong.map(([key]) => key)).toEqual([]);
  });
});
