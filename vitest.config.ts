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
          include: ['tests/unit/**/*.test.ts', 'shared/**/*.test.ts', 'server/**/*.test.ts'],
          exclude: ['**/*.integration.test.ts'],
        },
      },
      {
        // Against real databases: every test runs on SQLite, and on Postgres when TEST_POSTGRES_URL is set.
        test: {
          name: 'integration',
          environment: 'node',
          include: ['**/*.integration.test.ts'],
          exclude: ['node_modules/**'],
          globalSetup: ['tests/support/integration-setup.ts'],
          testTimeout: 20_000,
        },
      },
      ...storybookProjects,
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: [
        'shared/**/*.ts',
        'server/**/*.ts',
        'extensions/*/server/**/*.ts',
        'packages/*/src/**/*.ts',
        'scripts/**/*.mjs',
      ],
      exclude: ['**/*.test.*', '**/*.d.ts', 'scripts/**/check-*.mjs', 'scripts/conventions/pre-push.mjs', 'scripts/release/prepare.mjs', 'scripts/release/release-notes.mjs', 'scripts/agents/tdd-guard.mjs', 'scripts/agents/lint-fix.mjs'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        // Domain logic.
        'server/domain/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'extensions/*/server/domain/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'packages/*/src/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'server/database/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});
