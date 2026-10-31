import type { Page } from '@playwright/test';

/** The servers playwright.config.ts starts: with the demo, without it, and one never set up. */
export const DEMO_URL = 'http://127.0.0.1:3100';
export const EMPTY_URL = 'http://127.0.0.1:3101';
export const FRESH_URL = 'http://127.0.0.1:3102';

/** The administrator the global setup creates on the first two. */
export const ADMIN = { name: 'Ada', email: 'ada@homelab.example', password: 'correct horse battery' };

/** Where the global setup keeps the demo server's session. */
export const DEMO_SESSION = 'tests/e2e/.auth/demo.json';

/**
 * Signs in to another server than the demo one. Cookies are kept per host, not per port, so the demo server's cookie
 * is replaced for the rest of the test.
 */
export async function signInTo(page: Page, url: string): Promise<void> {
  const response = await page.request.post(`${url}/api/session`, { data: { email: ADMIN.email, password: ADMIN.password } });
  if (!response.ok()) {
    throw new Error(`Sign-in to ${url} failed: ${String(response.status())}`);
  }
}
