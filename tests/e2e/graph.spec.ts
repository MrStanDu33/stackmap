import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { EMPTY_URL, signInTo } from './support/accounts';

import type { Page } from '@playwright/test';

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
    await expect(page.getByRole('table', { name: /^Home server/ })).toBeVisible();
    for (const name of DEMO_SERVICES) {
      await expect(page.getByRole('button', { name, exact: true }).first()).toBeVisible();
    }
    await expectNoAxeViolation(page);
    await page.reload();
    await expect(page.getByRole('radio', { name: 'List' })).toBeChecked();
    await expect(page.getByRole('table', { name: /^Home server/ })).toBeVisible();
  });

  test('given the list, activating Nginx Proxy Manager opens its details; Escape closes them and returns focus to the row', async ({ page }) => {
    await page.goto('/graph?view=list');
    // The service's own row: the From column repeats it for the flows it sends.
    const npm = page.getByRole('table', { name: /^Home server/ }).getByRole('button', { name: 'Nginx Proxy Manager' }).first();

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

    // One h1, the page's: the narrow bar shows the app name without a heading.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expectNoAxeViolation(page);
    // Nuxt UI's toggle, with its own translated labels.
    await page.getByRole('button', { name: 'Open sidebar' }).click();
    const trafficLink = page.getByRole('link', { name: 'Traffic' });
    await expect(trafficLink).toBeVisible();
    await expect(trafficLink).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
    await expect(trafficLink).toBeHidden();
  });

  test('given a narrow screen, scrolling over the graph scrolls the page instead of zooming the graph', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 600 });
    await page.goto('/graph');
    await graphReady(page);
    const pane = page.locator('.vue-flow__transformationpane');
    // Once the first fit has finished animating.
    await page.waitForTimeout(800);
    const before = await pane.getAttribute('style');

    await page.locator('.vue-flow').hover();
    await page.mouse.wheel(0, 300);

    await page.waitForTimeout(300);
    await expect(pane).toHaveAttribute('style', before ?? '');
  });

  test('given the panel open, Escape in the language list closes only the list', async ({ page }) => {
    await page.goto('/graph?view=list');
    await page.getByRole('table', { name: /^Home server/ }).getByRole('button', { name: 'Website', exact: true }).first().click();
    const panel = page.getByRole('complementary');
    await expect(panel).toBeVisible();

    await page.getByRole('combobox', { name: 'Language' }).click();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(panel).toBeVisible();
  });

  test('given a selection closed, the live region does not repeat the summary', async ({ page }) => {
    await page.goto('/graph?view=list');
    const summary = page.getByRole('status').filter({ hasText: '2 hosts, 4 services, 9 flows' });
    await expect(summary).toHaveCount(1);
    await page.getByRole('table', { name: /^Home server/ }).getByRole('button', { name: 'Website', exact: true }).first().click();
    await expect(page.getByRole('status').filter({ hasText: 'Selected: Website' })).toHaveCount(1);

    await page.keyboard.press('Escape');

    await expect(page.getByRole('complementary')).toBeHidden();
    await expect(summary).toHaveCount(0);
  });

  test('given the list view while the traffic loads, it says so', async ({ page }) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/workspaces/*/traffic', async (route) => {
      await held;
      await route.continue();
    });

    await page.goto('/graph?view=list');

    await expect(page.getByRole('status').filter({ hasText: 'Loading the traffic…' })).toHaveCount(1);
    release();
    await expect(page.getByRole('table', { name: /^Home server/ })).toBeVisible();
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
    // The button is gone: focus moves to the page's heading rather than being lost.
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });

  test('given Nginx Proxy Manager 443/tcp, following "Trace app.homelab.example from the Internet" shows that trace with the form filled in', async ({ page }) => {
    await page.goto('/graph?view=list');
    await page.getByRole('table', { name: /^Home server/ }).getByRole('button', { name: 'Nginx Proxy Manager' }).first()
      .click();
    const panel = page.getByRole('complementary');
    await panel.getByRole('button', { name: /443\/tcp/ }).first().click();
    await expect(panel.getByRole('heading', { level: 2 })).toContainText('443/tcp');
    await expectNoAxeViolation(page);

    await panel.getByRole('link', { name: 'Trace app.homelab.example from the Internet' }).click();

    await expect(page).toHaveURL(/\/trace\?hostname=app\.homelab\.example&client=public/);
    await expect(page.getByRole('combobox', { name: 'Hostname' })).toHaveValue('app.homelab.example');
    await expect(page.getByRole('radio', { name: 'Internet' })).toBeChecked();
    await expect(page.getByRole('status').filter({ hasText: 'app.homelab.example from the Internet: 2 entries' }))
      .toHaveCount(1);
  });
});

test.describe('without a workspace', () => {
  test.use({ baseURL: EMPTY_URL });

  test('given no workspace, /graph explains how to get the demo workspace, with no error', async ({ page }) => {
    await signInTo(page, EMPTY_URL);
    await page.goto('/graph');

    await expect(page.getByRole('heading', { name: 'No workspace yet' })).toBeVisible();
    // The demo is off by default now: the hint says how to turn it on.
    await expect(page.getByText('STACKMAP_DEMO=true')).toBeVisible();
    await expect(page.getByRole('alert')).toBeHidden();
    await expectNoAxeViolation(page);
  });
});
