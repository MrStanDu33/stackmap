import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

const expectNoAxeViolation = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`))
    .toEqual([]);
};

const steps = (page: Page, count: number) => expect(page.locator('.vue-flow__edge')).toHaveCount(count);
const hostname = (page: Page) => page.getByRole('combobox', { name: 'Hostname' });

test.describe('trace view', () => {
  test('given the sidebar, Trace opens /trace with the form focused on the hostname and a hint, with no axe violation', async ({ page }) => {
    await page.goto('/graph');

    await page.getByRole('link', { name: 'Trace' }).click();

    await expect(page).toHaveURL(/\/trace$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Trace' })).toBeVisible();
    await expect(hostname(page)).toBeFocused();
    await expect(page.getByText('Enter a hostname to see how a request reaches it.')).toBeVisible();
    await expectNoAxeViolation(page);
  });

  test('given app.homelab.example from the Internet, the URL holds the query and the graph shows the entries and dependencies, announced, with no axe violation', async ({ page }) => {
    await page.goto('/trace');

    await hostname(page).fill('app.homelab.example');
    await page.getByRole('button', { name: 'Trace', exact: true }).click();

    await expect(page).toHaveURL(/\/trace\?hostname=app\.homelab\.example&client=public$/);
    await steps(page, 6);
    await expect(page.locator('[data-step-kind="dependency"]')).toHaveCount(2);
    for (const name of ['Website', 'Website database', 'Weather API']) {
      await expect(page.locator('.vue-flow').getByText(name, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('status').filter({ hasText: '2 entries, 4 steps, 2 dependencies' })).toHaveCount(1);
    await expectNoAxeViolation(page);
  });

  test('given port 443, only NPM 443 is an entry', async ({ page }) => {
    await page.goto('/trace?hostname=app.homelab.example&client=public&port=443&view=list');

    const request = page.getByRole('region', { name: 'Request' });
    await expect(request.getByRole('button', { name: /^From Internet to Nginx Proxy Manager, port 443\/tcp$/ })).toBeVisible();
    await expect(request.getByRole('button', { name: /port 80\/tcp/ })).toHaveCount(0);
  });

  test('given npm.homelab.example from the local network, the steps reach NPM 80, 443 and 81 and the routes to 81, with no cycle', async ({ page }) => {
    await page.goto('/trace?hostname=npm.homelab.example&client=internal&view=list');

    const request = page.getByRole('region', { name: 'Request' });
    for (const port of ['80', '443', '81']) {
      await expect(request.getByRole('button', { name: `From Local network to Nginx Proxy Manager, port ${port}/tcp` }))
        .toBeVisible();
    }
    await expect(request.getByRole('button', { name: /^From Nginx Proxy Manager to Nginx Proxy Manager, port 81\/tcp$/ }))
      .toHaveCount(2);
    await expect(page.getByText(/not followed again/)).toHaveCount(0);
  });

  test('given the list, activating the first step shows its hops in order; Escape closes the panel and returns focus', async ({ page }) => {
    await page.goto('/trace?hostname=app.homelab.example&client=public&view=list');
    const first = page.getByRole('region', { name: 'Request' }).getByRole('button').first();

    await first.focus();
    await page.keyboard.press('Enter');

    const hops = page.getByRole('complementary').getByRole('list', { name: 'Hops' }).getByRole('listitem');
    await expect(hops).toHaveText([/DNS.*resolves to 203\.0\.113\.10/, /Network.*Edge router forwards/]);
    await expectNoAxeViolation(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('complementary')).toBeHidden();
    await expect(first).toBeFocused();
  });

  test('given a name nothing serves, the page says so and offers the other client', async ({ page }) => {
    await page.goto('/trace?hostname=nowhere.homelab.example&client=public');

    // The page's message; the live region announces the same words.
    await expect(page.getByText('Nothing reaches nowhere.homelab.example from Internet.')
      .and(page.locator(':not([role="status"])'))).toBeVisible();
    await page.getByRole('button', { name: 'Try from Local network' }).click();
    await expect(page).toHaveURL(/client=internal/);
  });

  test('given a trace URL, the page fills the form and shows the trace, kept on reload', async ({ page }) => {
    await page.goto('/trace?hostname=app.homelab.example&client=public&port=443');

    await expect(hostname(page)).toHaveValue('app.homelab.example');
    await expect(page.getByRole('spinbutton', { name: /Port/ })).toHaveValue('443');
    await steps(page, 4);
    await page.reload();
    await steps(page, 4);
  });

  test('given an invalid query in the URL, no request is made and the form shows the errors', async ({ page }) => {
    let requested = false;
    await page.route('**/api/workspaces/*/trace**', async (route) => {
      requested = true;
      await route.continue();
    });

    await page.goto('/trace?hostname=*.homelab.example&port=0');

    await expect(page.getByText('A wildcard cannot be traced: enter one name')).toBeVisible();
    await expect(page.getByText('Enter a port from 1 to 65535')).toBeVisible();
    expect(requested).toBe(false);
  });

  test('given the trace route fails, Try again reloads it and focus moves to the heading', async ({ page }) => {
    let fail = true;
    await page.route('**/api/workspaces/*/trace**', (route) =>
      (fail ? route.fulfill({ status: 500, contentType: 'application/problem+json', body: '{}' }) : route.continue()));

    await page.goto('/trace?hostname=app.homelab.example&client=public');

    await expect(page.getByRole('alert')).toContainText('The trace could not be computed.');
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await steps(page, 6);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });
});
