import { request } from '@playwright/test';

import { ADMIN, DEMO_SESSION, DEMO_URL, EMPTY_URL, USER } from './support/accounts';

const TEMPORARY_PASSWORD = 'temporary horse battery';

/** Signs the plain user in with its temporary password and sets its own, in a context of its own. */
async function replaceTemporaryPassword(url: string): Promise<void> {
  const context = await request.newContext({ baseURL: url });
  try {
    await context.post('/api/session', { data: { email: USER.email, password: TEMPORARY_PASSWORD } });
    const changed = await context.put('/api/account/password', {
      data: { currentPassword: TEMPORARY_PASSWORD, newPassword: USER.password },
    });
    if (changed.status() !== 204) {
      throw new Error(`Changing the plain user's password on ${url} failed: ${String(changed.status())} ${await changed.text()}`);
    }
  } finally {
    await context.dispose();
  }
}

/**
 * Sets up the administrator on the demo and empty servers, adds the plain user there, and keeps the demo server's
 * session for the tests.
 */
export default async function globalSetup(): Promise<void> {
  for (const url of [DEMO_URL, EMPTY_URL]) {
    const context = await request.newContext({ baseURL: url });
    // The demo server seeds the demo at boot (STACKMAP_DEMO=true); the other has none.
    const response = await context.post('/api/setup', { data: { ...ADMIN, demo: false } });
    if (response.status() !== 201) {
      throw new Error(`Setup of ${url} failed: ${String(response.status())} ${await response.text()}`);
    }
    // As the administrator creates accounts (4c′), signed in by the setup, with a temporary password the user then
    // replaces (4d): only then can it use the app.
    const created = await context.post('/api/users', { data: { ...USER, password: TEMPORARY_PASSWORD } });
    if (created.status() !== 201) {
      throw new Error(`Creating the plain user on ${url} failed: ${String(created.status())} ${await created.text()}`);
    }
    await replaceTemporaryPassword(url);
    if (url === DEMO_URL) {
      await context.storageState({ path: DEMO_SESSION });
    }
    await context.dispose();
  }
}
