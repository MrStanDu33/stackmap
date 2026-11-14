import { expect } from '@playwright/test';

import type { Browser, Page } from '@playwright/test';

/** The servers playwright.config.ts starts: with the demo, without it, and one never set up. */
export const DEMO_URL = 'http://127.0.0.1:3100';
export const EMPTY_URL = 'http://127.0.0.1:3101';
export const FRESH_URL = 'http://127.0.0.1:3102';

/** The administrator the global setup creates on the first two. */
export const ADMIN = { name: 'Ada', email: 'ada@homelab.example', password: 'correct horse battery' };

/** An account that is not the instance administrator: the global setup creates it on the demo and empty servers. */
export const USER = { name: 'Grace', email: 'grace@homelab.example', password: 'correct horse battery' };

/** The environment variable holding a server's data directory (playwright.config.ts). */
export const dataDirVariable = (port: number | string) => `STACKMAP_E2E_DATA_DIR_${String(port)}`;

/** Where the global setup keeps the demo server's session. */
export const DEMO_SESSION = 'tests/e2e/.auth/demo.json';

/** A documentation address (RFC 5737) of its own: attempts are limited per address (the servers trust it). */
const ownAddress = () => `198.51.100.${String(1 + Math.floor(Math.random() * 254))}`;

/**
 * Signs in to a server, as the administrator unless told otherwise, from an address of its own (the servers trust
 * X-Forwarded-For). Cookies are kept per host, not per port, so the demo server's cookie is replaced for the rest of
 * the test.
 */
export async function signInTo(
  page: Page,
  url: string,
  account: { email: string; password: string } = ADMIN,
): Promise<void> {
  const response = await page.request.post(`${url}/api/session`, {
    data: { email: account.email, password: account.password },
    // A documentation address (RFC 5737) of its own: attempts are limited per address, 5 a minute.
    headers: { 'x-forwarded-for': ownAddress() },
  });
  if (!response.ok()) {
    throw new Error(`Sign-in to ${url} failed: ${String(response.status())}`);
  }
}

const TEMPORARY = 'temporary horse battery';

/** Changes the signed-in account's password through the API, from an address of its own; answers the status. */
export async function changePassword(page: Page, url: string, current: string, next: string): Promise<number> {
  const response = await page.request.put(`${url}/api/account/password`, {
    data: { currentPassword: current, newPassword: next },
    headers: { 'x-forwarded-for': ownAddress() },
  });
  return response.status();
}
/** The password `ownAccount` sets. */
export const OWN_PASSWORD = 'my own horse battery';

/**
 * An account of the test's own on the demo server, created by the administrator (`admin`, signed in), with its
 * password already its own, signed in in a fresh browser context. For tests that change an account's settings: the
 * administrator's session is shared by every suite.
 */
export async function ownAccount(admin: Page, browser: Browser) {
  const name = `Linus-${String(Date.now())}-${String(Math.floor(Math.random() * 1000))}`;
  const email = `${name.toLowerCase()}@homelab.example`;
  expect((await admin.request.post(`${DEMO_URL}/api/users`, { data: { name, email, password: TEMPORARY } })).status()).toBe(201);
  const context = await browser.newContext({ baseURL: DEMO_URL, storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await signInTo(page, DEMO_URL, { email, password: TEMPORARY });
  expect(await changePassword(page, DEMO_URL, TEMPORARY, OWN_PASSWORD)).toBe(204);
  return { page, context, email, temporary: TEMPORARY };
}
