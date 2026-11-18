import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { DEMO_URL, signInTo, USER } from './support/accounts';
import { hydrated } from './support/hydration';

import type { Page } from '@playwright/test';

const expectNoAxeViolation = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`))
    .toEqual([]);
};

// Chromium on Linux and Windows in CI: Ctrl. (macOS uses Cmd: unit tests cover it.)
const SHORTCUT = process.platform === 'darwin' ? 'Meta+k' : 'Control+k';
const LABEL = process.platform === 'darwin' ? '⌘K' : 'Ctrl+K';

test.describe('command palette', () => {
  test('given any signed-in page, the shortcut opens the Search dialog with the focus in its field, and Escape gives the focus back, with no axe violation (1)', async ({ page }) => {
    await page.goto('/settings');
    await hydrated(page);
    const traffic = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Traffic' });
    await traffic.focus();

    await page.keyboard.press(SHORTCUT);

    const dialog = page.getByRole('dialog', { name: 'Search' });
    await expect(dialog.getByRole('combobox', { name: 'Search' })).toBeFocused();
    await expectNoAxeViolation(page);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(traffic).toBeFocused();
  });

  test('given the sidebar, its Search button opens the palette, and closing it gives the focus back to the button, even after a click (1, review)', async ({ page }) => {
    await page.goto('/settings');
    await hydrated(page);
    const search = page.getByRole('button', { name: 'Search', exact: true });
    await expect(search).toContainText(LABEL);

    await search.click();
    await expect(page.getByRole('dialog', { name: 'Search' }).getByRole('combobox', { name: 'Search' })).toBeFocused();
    await page.keyboard.press('Escape');

    await expect(search).toBeFocused();
  });
});

test.describe('command palette groups', () => {
  const open = async (page: Page, url: string) => {
    await page.goto(url);
    await hydrated(page);
    await page.keyboard.press(SHORTCUT);
    const dialog = page.getByRole('dialog', { name: 'Search' });
    await expect(dialog.getByRole('combobox', { name: 'Search' })).toBeFocused();
    return dialog;
  };
  const group = (dialog: ReturnType<Page['getByRole']>, name: string) => dialog.getByRole('group', { name });

  test('given an empty search, it lists pages, workspaces and actions; typing a host\'s name finds it among the entities (3, 4)', async ({ page }) => {
    const dialog = await open(page, '/w/demo/graph');
    await expect(group(dialog, 'Pages')).toBeVisible();
    await expect(group(dialog, 'Actions')).toBeVisible();
    await expect(group(dialog, 'Entities')).toHaveCount(0);

    await page.keyboard.type('Edge router');

    await expect(group(dialog, 'Entities').getByRole('option', { name: /^Edge router/ })).toBeVisible();
  });

  test('choosing a page opens it, choosing a workspace opens the same page there (5, 6)', async ({ page }) => {
    const lab = `lab-${String(Date.now())}`;
    expect((await page.request.post(`${DEMO_URL}/api/workspaces`, { data: { name: `Lab ${lab}`, slug: lab } })).status()).toBe(201);
    await open(page, '/w/demo/graph');
    await page.keyboard.type('Members');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${DEMO_URL}/w/demo/members`);

    const dialog = await open(page, '/w/demo/members');
    await page.keyboard.type(`Lab ${lab}`);
    await expect(group(dialog, 'Workspaces').getByRole('option')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${DEMO_URL}/w/${lab}/members`);
  });

  test('the theme switch changes the theme and says so; Sign out signs out (7)', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: DEMO_URL, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await signInTo(page, DEMO_URL, USER);
    await open(page, '/settings');

    await page.keyboard.type('Theme');
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveClass(/\blight\b/);

    await open(page, '/settings');
    await page.keyboard.type('Sign out');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test('typing a hostname offers Trace <hostname>, which opens its trace (7)', async ({ page }) => {
    const dialog = await open(page, '/w/demo/graph');

    await page.keyboard.type('app.homelab.example');
    await expect(group(dialog, 'Actions').getByRole('option', { name: /^Trace app\.homelab\.example/ })).toBeVisible();
    await group(dialog, 'Actions').getByRole('option', { name: /^Trace app\.homelab\.example/ }).click();

    await expect(page).toHaveURL(`${DEMO_URL}/w/demo/trace?hostname=app.homelab.example`);
  });
});
