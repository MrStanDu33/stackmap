import { defineConfig } from 'vitest/config';

// Smoke tests of the Docker images (pnpm test:smoke). They need Docker and a built image, so `pnpm test` leaves them
// out; the Docker workflow runs them.
export default defineConfig({
  test: {
    name: 'smoke',
    environment: 'node',
    include: ['tests/smoke/**/*.smoke.test.ts'],
    testTimeout: 300_000,
    hookTimeout: 300_000,
    fileParallelism: false,
  },
});
