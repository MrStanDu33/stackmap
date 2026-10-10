// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui'],

  components: [{ path: '~/components', pathPrefix: false }],

  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2026-10-01',

  typescript: {
    strict: true,
    // Root tool configs (vitest, playwright…) are typechecked with the Node project.
    nodeTsConfig: {
      include: ['../*.config.ts'],
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
});
