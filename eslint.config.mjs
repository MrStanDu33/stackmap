// @ts-check
import storybook from 'eslint-plugin-storybook';
import vueA11y from 'eslint-plugin-vuejs-accessibility';
import tseslint from 'typescript-eslint';

import withNuxt from './.nuxt/eslint.config.mjs';

const typedFiles = ['**/*.ts', '**/*.mts', '**/*.vue'];

export default withNuxt(
  // Type-aware rules (typescript-eslint strict-type-checked) for TS and Vue files.
  {
    name: 'stackmap/typed-parser',
    files: typedFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  ...tseslint.configs.strictTypeCheckedOnly.map((config) => ({ ...config, files: typedFiles })),

  ...vueA11y.configs['flat/recommended'],

  ...storybook.configs['flat/recommended'],

  {
    name: 'stackmap/style',
    rules: {
      '@stylistic/max-len': ['error', {
        code: 120,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      }],
      'import/order': ['error', {
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      }],
    },
  },
);
