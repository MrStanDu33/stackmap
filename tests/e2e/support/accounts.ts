import type { Page } from '@playwright/test';

/** The servers playwright.config.ts starts: with the demo, without it, and one never set up. */
export const DEMO_URL = 'http://127.0.0.1:3100';
export const EMPTY_URL = 'http://127.0.0.1:3101';
export const FRESH_URL = 'http://127.0.0.1:3102';

/** The administrator the global setup creates on the first two. */
export const ADMIN = { name: 'Ada', email: 'ada@homelab.example', password: 'correct horse battery' };

/**
 * An account that is not the instance administrator. Stackmap creates such accounts only through invitations (phase
 * 4c): the global setup writes it into the demo and empty servers' databases.
 */
export const USER = { name: 'Grace', email: 'grace@homelab.example', password: 'correct horse battery' };

/** The environment variable holding a server's data directory (playwright.config.ts). */
export const dataDirVariable = (port: number | string) => `STACKMAP_E2E_DATA_DIR_${String(port)}`;

/** Where the global setup keeps the demo server's session. */
export const DEMO_SESSION = 'tests/e2e/.auth/demo.json';

/**
 * Signs in to a server, as the administrator unless told otherwise. Cookies are kept per host, not per port, so the
 * demo server's cookie is replaced for the rest of the test.
 */
export async function signInTo(
  page: Page,
  url: string,
  account: { email: string; password: string } = ADMIN,
): Promise<void> {
  const response = await page.request.post(`${url}/api/session`, {
    data: { email: account.email, password: account.password },
  });
  if (!response.ok()) {
    throw new Error(`Sign-in to ${url} failed: ${String(response.status())}`);
  }
}
