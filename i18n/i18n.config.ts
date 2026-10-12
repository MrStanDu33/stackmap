// vue-i18n options for every language, including the ones locale packs add. A plain function, as defineI18nConfig
// returns, so it also typechecks outside the app's context (its test).
export default () => ({
  // A locale pack may lag behind the app: a key it does not translate shows in English.
  fallbackLocale: 'en',
});
