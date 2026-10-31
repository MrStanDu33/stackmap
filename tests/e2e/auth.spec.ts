import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { ADMIN, FRESH_URL } from './support/accounts';

import type { Page } from '@playwright/test';

const expectNoAxeViolation = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`))
    .toEqual([]);
};

const fillSignIn = async (page: Page, password = ADMIN.password) => {
  await page.getByRole('textbox', { name: 'Email' }).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
};

// One server, set up by the first test: the tests run in order, each signed out at its start.
test.describe.configure({ mode: 'serial' });
test.use({ baseURL: FRESH_URL, storageState: { cookies: [], origins: [] } });

test.describe('sign-in', () => {
  test('given a fresh instance, any page leads to /setup, with no axe violation (1, 25)', async ({ page }) => {
    await page.goto('/graph');

    await expect(page).toHaveURL(`${FRESH_URL}/setup`);
    await expect(page.getByRole('heading', { level: 1, name: 'Set up Stackmap' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Display' })).toBeVisible();
    await expectNoAxeViolation(page);
  });

  test('given /setup with the demo checked, creating the admin signs in and shows the demo graph (2)', async ({ page }) => {
    await page.goto('/setup');

    await page.getByRole('textbox', { name: 'Name' }).fill(ADMIN.name);
    await page.getByRole('textbox', { name: 'Email' }).fill(ADMIN.email);
    await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
    await expect(page.getByRole('checkbox', { name: 'Add the demo workspace' })).toBeChecked();
    await page.getByRole('button', { name: 'Create the admin account' }).click();

    await expect(page).toHaveURL(`${FRESH_URL}/graph`);
    await expect(page.locator('.vue-flow__edge')).toHaveCount(9);
    await expect(page.getByText(ADMIN.name)).toBeVisible();
  });

  test('given an account, /setup leads to /login (4)', async ({ page }) => {
    await page.goto('/setup');

    await expect(page).toHaveURL(`${FRESH_URL}/login`);
  });

  test('given signed out, /graph leads to /login?redirect=/graph and back after signing in; then /login and /setup lead to /, and Sign out ends the session (9, 13, 15, 24)', async ({ page }) => {
    await page.goto('/graph?view=list');
    // However the router writes the query, it names the page asked for.
    await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('redirect') === '/graph?view=list');
    await expectNoAxeViolation(page);

    await fillSignIn(page);
    await expect(page).toHaveURL(`${FRESH_URL}/graph?view=list`);

    await page.goto('/login');
    await expect(page).toHaveURL(`${FRESH_URL}/graph`);
    await page.goto('/setup');
    await expect(page).toHaveURL(`${FRESH_URL}/graph`);

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(`${FRESH_URL}/login`);
    await page.goBack();
    await expect(page).toHaveURL(/\/login/);
  });

  test('given a wrong password, the form says the email or password is incorrect (10)', async ({ page }) => {
    await page.goto('/login');

    await fillSignIn(page, 'not the password');

    await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');
    await expect(page).toHaveURL(`${FRESH_URL}/login`);
  });

  test('given a redirect to another site, signing in stays on Stackmap (14)', async ({ page }) => {
    await page.goto('/login?redirect=//evil.example/');

    await fillSignIn(page);

    await expect(page).toHaveURL(new RegExp(`^${FRESH_URL}/graph$`));
  });
});
