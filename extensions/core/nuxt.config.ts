// A Nuxt layer of the app: its locale files are merged with the app's.
export default defineNuxtConfig({
  i18n: {
    locales: [
      { code: 'en', file: 'en.json' },
      { code: 'fr', file: 'fr.json' },
    ],
  },
});
