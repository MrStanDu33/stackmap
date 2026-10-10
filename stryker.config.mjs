// Mutation testing of the domain logic (nightly, see .github/workflows/mutation.yml).

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  // @stryker-mutator/vitest-runner 10 predates Vitest 5 and silently never activates mutants with it. The command
  // runner starts Vitest per mutant with __STRYKER_ACTIVE_MUTANT__ set, which the instrumented code reads. Slower, but
  // correct; switch back to the Vitest runner once it supports Vitest 5.
  testRunner: 'command',
  commandRunner: { command: 'pnpm exec vitest run --config vitest.mutation.config.ts' },
  coverageAnalysis: 'off',
  mutate: [
    'shared/**/*.ts',
    'server/domain/**/*.ts',
    'extensions/*/server/domain/**/*.ts',
    'packages/*/src/**/*.ts',
    'scripts/**/*.mjs',
    '!**/*.test.*',
    '!**/*.d.ts',
    // Thin CLI wrappers around the tested rules.
    '!scripts/**/check-*.mjs',
    '!scripts/conventions/pre-push.mjs',
    '!scripts/release/prepare.mjs',
    '!scripts/release/release-notes.mjs',
    '!scripts/agents/tdd-guard.mjs',
    '!scripts/agents/lint-fix.mjs',
  ],
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  // Tracked, not enforced yet: raise `break` once the score is stable.
  thresholds: { high: 90, low: 75, break: null },
  tempDirName: '.stryker-tmp',
  // The sandbox skips git-ignored files, but tsconfig.json references Nuxt's generated tsconfigs.
  ignorePatterns: ['!.nuxt'],
};
