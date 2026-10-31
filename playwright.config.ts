import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineConfig, devices } from '@playwright/test';

/** The built app with the demo workspace, and a second one started without it. Run `pnpm build` first. */
const DEMO_URL = 'http://127.0.0.1:3100';

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
  use: { baseURL: DEMO_URL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [server(3100), server(3101, { STACKMAP_DEMO: 'false' })],
});
