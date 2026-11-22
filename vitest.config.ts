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
      // Only stops a hung story: a story passes or fails on the code, never on how busy the machine is. Waits are
      // guarded the same way, in .storybook/preview.ts.
      testTimeout: 120_000,
      // The eight projects run at once, and Vitest opens up to (CPUs - 1) pages for each: 24 on CI's 4 vCPUs. One page
      // per project is also the fastest run locally; the flake hunt sets 0 to overload the runner on purpose.
      maxWorkers: Number(process.env.STORY_PAGES_PER_PROJECT ?? 1) || undefined,
      browser: {
        enabled: true,
        headless: true,
        // Nothing animates (a11y.css), so no story checks an element mid-animation. The e2e tests keep the default
        // motion, with axe.
        provider: playwright({ contextOptions: { reducedMotion: 'reduce' } }),
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
        // The app's alias for shared code, as Nuxt and Storybook resolve it: client helpers import contracts with it.
        resolve: { alias: { '#shared': join(import.meta.dirname, 'shared') } },
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'tests/unit/**/*.test.ts',
            'shared/**/*.test.ts',
            'server/**/*.test.ts',
            'packages/*/src/**/*.test.ts',
            'extensions/*/**/*.test.ts',
            'app/**/*.test.ts',
            'modules/**/*.test.ts',
          ],
          exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
        },
      },
      {
        // Against real databases: every test runs on SQLite, and on Postgres when TEST_POSTGRES_URL is set.
        test: {
          name: 'integration',
          environment: 'node',
          include: ['**/*.integration.test.ts'],
          exclude: ['**/node_modules/**'],
          globalSetup: ['tests/support/integration-setup.ts'],
          testTimeout: 20_000,
          // Fictional, for tests only: Better Auth would otherwise write a secret into ./data. The tests send
          // X-Forwarded-For to tell clients apart.
          env: { BETTER_AUTH_SECRET: 'integration-tests-only-not-a-real-secret-0123456789', TRUST_PROXY: 'true' },
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
        'extensions/*/server.ts',
        'extensions/*/entities/**/*.ts',
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
        // Workspace isolation, which everything else relies on, and the entities extensions build on it.
        'server/repositories/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'extensions/*/entities/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'extensions/*/server/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});
