import { join } from 'node:path';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

import type { TestProjectInlineConfiguration } from 'vitest/config';

const THEMES = ['midnight', 'light'] as const;
const CONTRASTS = ['standard', 'strict'] as const;
const LOCALES = ['en', 'fr'] as const;

/** Stories run as component tests (play functions + axe) in Chromium, once per theme × contrast × locale. */
const storybookProjects = THEMES.flatMap((theme) => CONTRASTS.flatMap((contrast) => LOCALES.map(
  (locale): TestProjectInlineConfiguration => ({
    plugins: [storybookTest({ configDir: join(import.meta.dirname, '.storybook') })],
    // Read by .storybook/preview.ts as the initial toolbar globals.
    define: {
      'import.meta.env.STORYBOOK_THEME': JSON.stringify(theme),
      'import.meta.env.STORYBOOK_CONTRAST': JSON.stringify(contrast),
      'import.meta.env.STORYBOOK_LOCALE': JSON.stringify(locale),
    },
    test: {
      name: `storybook:${theme}-${contrast}-${locale}`,
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: 'chromium' }],
      },
    },
  }),
)));

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'scripts',
          environment: 'node',
          include: ['scripts/**/*.test.mjs'],
        },
      },
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts', 'shared/**/*.test.ts'],
        },
      },
      ...storybookProjects,
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
