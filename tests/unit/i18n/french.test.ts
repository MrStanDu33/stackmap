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

describe('French', () => {
  it('puts 0 and 1 in the singular, as French does', () => {
    const { t } = createI18n({ ...i18nConfig(), legacy: false, locale: 'fr', messages: { en, fr } }).global;
    const hosts = (count: number) => t('traffic.count.hosts', { count }, count);

    expect([hosts(0), hosts(1), hosts(2)]).toEqual(['0 hôte', '1 hôte', '2 hôtes']);
  });

  it('uses a non-breaking space before : ; ! ? and typographic apostrophes', () => {
    const wrong = strings(fr).filter(([, value]) => / [:;!?]/.test(value) || value.includes('\''));

    expect(wrong.map(([key]) => key)).toEqual([]);
  });
});
