import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

/** The app started with STACKMAP_DEMO=false (playwright.config.ts). */
const EMPTY_URL = 'http://localhost:3101';
const DEMO_SERVICES = ['Nginx Proxy Manager', 'Website', 'Website database', 'Weather API'];

const expectNoAxeViolation = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`))
    .toEqual([]);
};

const graphReady = async (page: Page) => {
  await expect(page.locator('.vue-flow__edge')).toHaveCount(9);
};

test.describe('traffic view', () => {
  test('given a fresh start, / leads to /graph showing the demo hosts, services and flows, with no axe violation', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/graph$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Traffic' })).toBeVisible();
    await graphReady(page);
    for (const name of ['Edge router', 'Home server', ...DEMO_SERVICES]) {
      await expect(page.locator('.vue-flow').getByText(name, { exact: true })).toBeVisible();
    }
    // Our live region: Nuxt's route announcer is another status region.
    await expect(page.getByRole('status').filter({ hasText: '2 hosts, 4 services, 9 flows' })).toHaveCount(1);
    await expectNoAxeViolation(page);
  });

  test('given /graph, choosing List shows the same hosts, services and ports in ?view=list, kept on reload', async ({ page }) => {
    await page.goto('/graph');
    await graphReady(page);

    await page.getByRole('radio', { name: 'List' }).click();

    await expect(page).toHaveURL(/\?view=list$/);
    await expect(page.getByRole('table', { name: 'Home server' })).toBeVisible();
    for (const name of DEMO_SERVICES) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expectNoAxeViolation(page);
    await page.reload();
    await expect(page.getByRole('radio', { name: 'List' })).toBeChecked();
    await expect(page.getByRole('table', { name: 'Home server' })).toBeVisible();
  });

  test('given the list, activating Nginx Proxy Manager opens its details; Escape closes them and returns focus to the row', async ({ page }) => {
    await page.goto('/graph?view=list');
    const npm = page.getByRole('table', { name: 'Home server' }).getByRole('button', { name: 'Nginx Proxy Manager' });

    await npm.focus();
    await page.keyboard.press('Enter');

    const panel = page.getByRole('complementary');
    await expect(panel.getByRole('heading', { level: 2, name: 'Nginx Proxy Manager' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Incoming flows' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Outgoing flows' })).toBeVisible();
    await expectNoAxeViolation(page);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(npm).toBeFocused();
  });

  test('given the graph, Enter on a focused service node opens the panel and announces the selection', async ({ page }) => {
    await page.goto('/graph');
    await graphReady(page);

    await page.locator('.vue-flow__node[data-id^="service:"]').filter({ hasText: 'Website database' }).focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('complementary').getByRole('heading', { level: 2, name: 'Website database' }))
      .toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Selected: Website database' })).toHaveCount(1);
  });

  test('given the sidebar, French, light theme and strict contrast apply and survive a reload', async ({ page }) => {
    await page.goto('/graph');

    await page.getByRole('radio', { name: 'Light' }).click();
    await page.getByRole('radio', { name: 'RGAA strict' }).click();
    await page.getByRole('combobox', { name: 'Language' }).click();
    await page.getByRole('option', { name: 'Français' }).click();

    const html = page.locator('html');
    await expect(page.getByRole('heading', { level: 1, name: 'Trafic' })).toBeVisible();
    await expect(html).toHaveClass(/\blight\b/);
    await expect(html).toHaveAttribute('data-contrast', 'strict');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Trafic' })).toBeVisible();
    await expect(html).toHaveClass(/\blight\b/);
    await expect(html).toHaveAttribute('data-contrast', 'strict');
    await expect(html).toHaveAttribute('lang', /^fr/);
    await expectNoAxeViolation(page);
  });

  test('given a narrow screen, the sidebar opens as a drawer and closes with Escape', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/graph');

    // Nuxt UI's toggle, with its own translated labels.
    await page.getByRole('button', { name: 'Open sidebar' }).click();
    const graphLink = page.getByRole('link', { name: 'Graph' });
    await expect(graphLink).toBeVisible();
    await expect(graphLink).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
    await expect(graphLink).toBeHidden();
  });

  test('given the traffic route fails, the page shows an error and Try again reloads it', async ({ page }) => {
    let fail = true;
    await page.route('**/api/workspaces/*/traffic', (route) =>
      (fail ? route.fulfill({ status: 500, contentType: 'application/problem+json', body: '{}' }) : route.continue()));

    await page.goto('/graph');

    await expect(page.getByRole('alert')).toContainText('The traffic could not be loaded.');
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await graphReady(page);
  });
});

test.describe('without a workspace', () => {
  test.use({ baseURL: EMPTY_URL });

  test('given no workspace, /graph explains how to get the demo workspace, with no error', async ({ page }) => {
    await page.goto('/graph');

    await expect(page.getByRole('heading', { name: 'No workspace yet' })).toBeVisible();
    await expect(page.getByText('STACKMAP_DEMO=false')).toBeVisible();
    await expect(page.getByRole('alert')).toBeHidden();
    await expectNoAxeViolation(page);
  });
});
