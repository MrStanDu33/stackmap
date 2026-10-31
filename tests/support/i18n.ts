import { createI18n } from 'vue-i18n';

import coreEn from '../../extensions/core/i18n/locales/en.json';
import coreFr from '../../extensions/core/i18n/locales/fr.json';
import natEn from '../../extensions/nat/i18n/locales/en.json';
import natFr from '../../extensions/nat/i18n/locales/fr.json';
import proxyEn from '../../extensions/reverse-proxy/i18n/locales/en.json';
import proxyFr from '../../extensions/reverse-proxy/i18n/locales/fr.json';
import i18nConfig from '../../i18n/i18n.config';
import en from '../../i18n/locales/en.json';
import fr from '../../i18n/locales/fr.json';

/** Each extension's strings sit under `extensions.<id>`: merging them never overwrites the app's. */
const withExtensions = (app: object, ...packs: { extensions: object }[]) => ({
  ...app,
  extensions: Object.assign({}, ...packs.map(({ extensions }) => extensions)) as object,
});

/** The app's strings with the built-in extensions', as the app merges them: what stories and client tests read. */
export const MESSAGES = {
  en: withExtensions(en, coreEn, natEn, proxyEn),
  fr: withExtensions(fr, coreFr, natFr, proxyFr),
};

export const createTestI18n = (locale: 'en' | 'fr' = 'en') =>
  createI18n({ ...i18nConfig(), legacy: false, locale, fallbackLocale: 'en', messages: MESSAGES });
