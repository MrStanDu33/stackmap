import { fileURLToPath } from 'node:url';

import { findExtensionLayers } from './scripts/extensions/layers.mjs';
import { APP_LOCALES } from './shared/i18n/locales';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Every built-in extension is a Nuxt layer: its locale files now, its pages and components later.
  extends: findExtensionLayers(fileURLToPath(new URL('.', import.meta.url))),

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
      include: [
        '../*.config.ts',
        '../tests/unit/**/*',
        '../tests/support/**/*',
        '../tests/smoke/**/*',
        // The extension SDK and the built-in extensions' manifests and tests.
        '../packages/*/src/**/*',
        '../extensions/*/*.ts',
      ],
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
    // The app's languages; modules/extension-locales.ts adds the extensions' strings and the languages they add.
    locales: APP_LOCALES.map((locale) => ({ ...locale })),
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'stackmap_locale',
      fallbackLocale: 'en',
    },
  },

  // Icons come from the bundled Lucide collection (@iconify-json/lucide), never from the Iconify API.
  icon: {
    serverBundle: { collections: ['lucide'] },
    fallbackToApi: false,
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
