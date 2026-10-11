// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxtjs/i18n', '@scalar/nuxt'],

  components: [{ path: '~/components', pathPrefix: false }],

  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  // Midnight is the default theme; the light theme is opt-in.
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
  },

  ui: {
    // No remote font providers: builds work offline and the app makes no third-party font requests.
    fonts: false,
  },

  compatibilityDate: '2026-10-01',

  typescript: {
    strict: true,
    // Root tool configs (vitest, playwright…) and Node-side tests and helpers are typechecked with the Node project.
    nodeTsConfig: {
      include: ['../*.config.ts', '../tests/unit/**/*', '../tests/support/**/*', '../tests/smoke/**/*'],
    },
  },

  eslint: {
    config: {
      // Airbnb-like formatting; see eslint.config.mjs for the remaining rules.
      stylistic: {
        indent: 2,
        quotes: 'single',
        semi: true,
        commaDangle: 'always-multiline',
        braceStyle: '1tbs',
        arrowParens: true,
        quoteProps: 'as-needed',
      },
      typescript: { strict: true },
    },
  },

  i18n: {
    // URLs carry no locale prefix: the locale comes from the user setting, then the cookie, then the browser.
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'stackmap_locale',
      fallbackLocale: 'en',
    },
  },

  // API reference at /api/docs, generated from the contracts. No remote fonts, telemetry, AI or sharing services.
  scalar: {
    url: '/api/openapi.json',
    pathRouting: { basePath: '/api/docs' },
    metaData: { title: 'Stackmap API' },
    withDefaultFonts: false,
    telemetry: false,
    agent: { disabled: true },
    mcp: { disabled: true },
    // The toolbar offers to share and deploy the document through Scalar's services.
    showDeveloperTools: 'never',
    // The "Open API Client" button opens client.scalar.com with the document's URL.
    hideClientButton: true,
    devtools: false,
  },
});
