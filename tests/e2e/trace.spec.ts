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
const firstStep = (page: Page) => page.getByRole('region', { name: 'Request' }).getByRole('button').first();
const SELECTED_STEP = /[?&]selected=step(:|%3A)/;

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
    // Named, so a new result is told apart from the last one.
    await expect(page.getByRole('status')
      .filter({ hasText: 'app.homelab.example from the Internet: 2 entries, 4 steps, 2 dependencies' })).toHaveCount(1);
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
    await expect(page.getByText('Nothing reaches nowhere.homelab.example from the Internet.')
      .and(page.locator(':not([role="status"])'))).toBeVisible();
    await page.getByRole('button', { name: 'Try from the local network' }).click();
    await expect(page).toHaveURL(/client=internal/);
    // The button is gone with the old result: focus moves to the heading rather than being lost.
    await expect(page.getByText('Nothing reaches nowhere.homelab.example from the local network.')
      .and(page.locator(':not([role="status"])'))).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });

  test('given a new trace loading, the old result is gone and the new one is announced with its name, even with the same counts', async ({ page }) => {
    await page.goto('/trace?hostname=app.homelab.example&client=public&view=list');
    await expect(page.getByRole('status').filter({ hasText: 'app.homelab.example from the Internet' })).toHaveCount(1);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/workspaces/*/trace**', async (route) => {
      await held;
      await route.continue();
    });

    await hostname(page).fill('homelab.example');
    await page.getByRole('button', { name: 'Trace', exact: true }).click();

    await expect(page.getByText('Tracing homelab.example…')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Request' })).toBeHidden();
    release();
    await expect(page.getByRole('status').filter({ hasText: 'homelab.example from the Internet: 2 entries' })).toHaveCount(1);
  });

  test('given a truncated trace, the graph view says only part of it is shown', async ({ page }) => {
    await page.route('**/api/workspaces/*/trace**', async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, json: { ...(await response.json() as object), truncated: true } });
    });

    await page.goto('/trace?hostname=app.homelab.example&client=public');

    await expect(page.getByText('Only part of this trace is shown: it stops at 500 services or 1,000 steps.')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Only part of this trace is shown' })).toHaveCount(1);
  });

  test('given the panel open, Escape in the form leaves it open and the focus in the field', async ({ page }) => {
    await page.goto('/trace?hostname=app.homelab.example&client=public&view=list');
    await page.getByRole('region', { name: 'Request' }).getByRole('button').first().click();
    await expect(page.getByRole('complementary')).toBeVisible();

    await hostname(page).focus();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('complementary')).toBeVisible();
    await expect(hostname(page)).toBeFocused();
  });

  test('given a trace URL, the page fills the form and shows the trace, kept on reload', async ({ page }) => {
    await page.goto('/trace?hostname=app.homelab.example&client=public&port=443');

    await expect(hostname(page)).toHaveValue('app.homelab.example');
    await expect(page.getByRole('textbox', { name: /Port/ })).toHaveValue('443');
    await steps(page, 4);
    await page.reload();
    await steps(page, 4);
  });

  test('given an invalid query in the URL, no request is made, the form shows the errors and focuses the first', async ({ page }) => {
    let requested = false;
    await page.route('**/api/workspaces/*/trace**', async (route) => {
      requested = true;
      await route.continue();
    });

    await page.goto('/trace?hostname=*.homelab.example&port=0');

    await expect(page.getByText('A wildcard cannot be traced: enter one name')).toBeVisible();
    await expect(page.getByText('Enter a port from 1 to 65535')).toBeVisible();
    await expect(hostname(page)).toBeFocused();
    await expect(page.getByText('Enter a hostname to see how a request reaches it.')).toBeHidden();
    expect(requested).toBe(false);

    await page.goto('/trace?port=0');
    await expect(page.getByText('Enter a port from 1 to 65535')).toBeVisible();
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

  test('given a step selected, Next selects the following one and the live region says "Step 3 of 6: …"', async ({ page }) => {
    await page.goto('/trace?hostname=app.homelab.example&client=public&view=list');
    await firstStep(page).click();
    const walk = page.getByRole('complementary').getByRole('navigation', { name: 'Steps' });

    await walk.getByRole('button', { name: 'Next step' }).click();
    await walk.getByRole('button', { name: 'Next step' }).click();

    await expect(walk.getByText('Step 3 of 6')).toBeVisible();
    await expect(page.getByRole('status')
      .filter({ hasText: 'Step 3 of 6: From Nginx Proxy Manager to Website, port 3000/tcp' })).toHaveCount(1);
    await expect(walk.getByRole('button', { name: 'Next step' })).toBeFocused();
    await expectNoAxeViolation(page);
  });

  test('given a step selected, the URL has selected=step:<id>, replaced rather than pushed', async ({ page }) => {
    await page.goto('/graph');
    await page.goto('/trace?hostname=app.homelab.example&client=public&view=list');

    await firstStep(page).click();
    await expect(page).toHaveURL(SELECTED_STEP);
    await page.getByRole('button', { name: 'Next step' }).click();
    await expect(page).toHaveURL(SELECTED_STEP);

    // One entry for the trace, whatever was selected on it.
    await page.goBack();
    await expect(page).toHaveURL(/\/graph$/);
  });

  test('given a URL with selected=step:<id>, the page opens with that step\'s panel', async ({ page }) => {
    await page.goto('/trace?hostname=app.homelab.example&client=public&view=list');
    await firstStep(page).click();
    await page.getByRole('button', { name: 'Next step' }).click();
    await expect(page).toHaveURL(SELECTED_STEP);
    const link = page.url();

    await page.goto('/graph');
    await page.goto(link);

    const panel = page.getByRole('complementary');
    await expect(panel.getByText('Step 2 of 6')).toBeVisible();
    await expect(panel.getByRole('heading', { level: 2 })).toHaveText('From Internet to Nginx Proxy Manager, port 443/tcp');
  });

  test('given a selected value not in the trace, no panel opens and the parameter is removed', async ({ page }) => {
    for (const selected of ['step:gone', 'host:anything', 'nonsense']) {
      await page.goto(`/trace?hostname=app.homelab.example&client=public&selected=${selected}`);

      await expect(page.getByRole('status').filter({ hasText: 'app.homelab.example from the Internet' })).toHaveCount(1);
      await expect(page).not.toHaveURL(/selected=/);
      await expect(page.getByRole('complementary')).toBeHidden();
    }
  });

  test('given a new trace asked for, the selection is removed from the URL', async ({ page }) => {
    await page.goto('/trace?hostname=app.homelab.example&client=public&view=list');
    await firstStep(page).click();
    await expect(page).toHaveURL(SELECTED_STEP);

    await hostname(page).fill('homelab.example');
    await page.getByRole('button', { name: 'Trace', exact: true }).click();

    await expect(page).toHaveURL(/hostname=homelab\.example/);
    await expect(page).not.toHaveURL(/selected=/);
    await expect(page.getByRole('complementary')).toBeHidden();
  });

  test('given the panel closed by its button or Escape, selected is removed from the URL', async ({ page }) => {
    await page.goto('/trace?hostname=app.homelab.example&client=public&view=list');

    await firstStep(page).click();
    await expect(page).toHaveURL(SELECTED_STEP);
    await page.getByRole('complementary').getByRole('button', { name: 'Close details' }).click();
    await expect(page).not.toHaveURL(/selected=/);

    await firstStep(page).click();
    await expect(page).toHaveURL(SELECTED_STEP);
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/selected=/);
  });
});
