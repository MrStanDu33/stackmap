import { request } from '@playwright/test';

import { ADMIN, DEMO_SESSION, DEMO_URL, EMPTY_URL } from './support/accounts';

/** Sets up the administrator on the demo and empty servers, and keeps the demo server's session for the tests. */
export default async function globalSetup(): Promise<void> {
  for (const url of [DEMO_URL, EMPTY_URL]) {
    const context = await request.newContext({ baseURL: url });
    // The demo server seeds the demo at boot (STACKMAP_DEMO=true); the other has none.
    const response = await context.post('/api/setup', { data: { ...ADMIN, demo: false } });
    if (response.status() !== 201) {
      throw new Error(`Setup of ${url} failed: ${String(response.status())} ${await response.text()}`);
    }
    if (url === DEMO_URL) {
      await context.storageState({ path: DEMO_SESSION });
    }
    await context.dispose();
  }
}
