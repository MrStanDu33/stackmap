import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import { DEMO_SESSION, DEMO_URL } from './tests/e2e/support/accounts';

const server = (port: number, env: Record<string, string> = {}) => ({
  command: 'node .output/server/index.mjs',
  url: `http://127.0.0.1:${String(port)}/api/health`,
  // A fresh SQLite database per run, so the demo workspace is seeded as on a first start.
  // Pinned rather than inherited from the shell: a DATABASE_URL there must not receive the test data, and the servers
  // listen on this machine only.
  env: {
    DATABASE_URL: '',
    STACKMAP_DEMO: 'true',
    HOST: '127.0.0.1',
    PORT: String(port),
    DATA_DIR: mkdtempSync(join(tmpdir(), 'stackmap-e2e-')),
    ...env,
  },
  reuseExistingServer: false,
  timeout: 60_000,
});

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? 'github' : 'list',
  // Signed in to the demo server by the global setup; tests of other servers sign in themselves.
  globalSetup: './tests/e2e/global-setup.ts',
  use: { baseURL: DEMO_URL, storageState: DEMO_SESSION, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  /** The built app with the demo, one without it, and one never set up. Run `pnpm build` first. */
  webServer: [server(3100), server(3101, { STACKMAP_DEMO: 'false' }), server(3102, { STACKMAP_DEMO: 'false' })],
});
