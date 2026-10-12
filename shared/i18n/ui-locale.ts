import * as nuxtUiLocales from '@nuxt/ui/locale';

export type UiLocale = typeof nuxtUiLocales.en;

const LOCALES: UiLocale[] = Object.values(nuxtUiLocales);

/**
 * Nuxt UI's own strings (close buttons, pagination…) for a language: an exact match, else its base language
 * (`fr-CA` → `fr`), else English. Imports every Nuxt UI locale: load it on demand, for languages the app does not
 * bundle.
 */
export function uiLocaleFor(code: string): UiLocale {
  const wanted = code.toLowerCase();
  const base = wanted.split('-')[0];
  return LOCALES.find((locale) => locale.code.toLowerCase() === wanted)
    ?? LOCALES.find((locale) => locale.code.toLowerCase() === base)
    ?? nuxtUiLocales.en;
}
