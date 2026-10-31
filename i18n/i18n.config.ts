// vue-i18n options for every language, including the ones locale packs add. A plain function, as defineI18nConfig
// returns, so it also typechecks outside the app's context (its test).
export default () => ({
  // A locale pack may lag behind the app: a key it does not translate shows in English.
  fallbackLocale: 'en',
  // French puts 0 in the singular (« 0 hôte »); vue-i18n's default rule puts it in the plural, as English does.
  pluralRules: {
    fr: (choice: number, choicesLength: number) => (choicesLength === 2
      ? Number(Math.abs(choice) >= 2)
      : Math.min(Math.abs(choice), 2)),
  },
});
