import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineConfig, devices } from '@playwright/test';

/** The built app with the demo workspace, and a second one started without it. Run `pnpm build` first. */
const DEMO_URL = 'http://localhost:3100';

const server = (port: number, env: Record<string, string> = {}) => ({
  command: 'node .output/server/index.mjs',
  url: `http://localhost:${String(port)}/api/health`,
  // A fresh SQLite database per run, so the demo workspace is seeded as on a first start.
  env: { PORT: String(port), DATA_DIR: mkdtempSync(join(tmpdir(), 'stackmap-e2e-')), ...env },
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
