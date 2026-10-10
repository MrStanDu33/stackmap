import { defineConfig } from 'vitest/config';

// Used by Stryker (stryker.config.mjs) only. Stryker activates each mutant through values provided to the root
// Vitest project, which do not reach `projects`, so this config has none. Keep the globs in sync with the Node-side
// projects of vitest.config.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/**/*.test.mjs', 'tests/unit/**/*.test.ts', 'shared/**/*.test.ts'],
  },
});
