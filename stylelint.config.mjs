// Tailwind v4 at-rules and functions that plain CSS linters do not know.
const tailwindAtRules = ['theme', 'source', 'utility', 'variant', 'custom-variant', 'apply', 'reference', 'plugin', 'config'];

/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard', 'stylelint-config-recommended-vue'],
  plugins: ['stylelint-order'],
  ignoreFiles: ['.nuxt/**', '.output/**', 'node_modules/**', 'coverage/**', 'storybook-static/**'],
  rules: {
    'at-rule-no-unknown': [true, { ignoreAtRules: tailwindAtRules }],
    'at-rule-no-deprecated': [true, { ignoreAtRules: tailwindAtRules }],
    'function-no-unknown': [true, { ignoreFunctions: ['theme', '--alpha', '--spacing'] }],
    'import-notation': 'string',
    'order/order': ['custom-properties', 'declarations'],
  },
};
