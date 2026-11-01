import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { DEMO_URL, EMPTY_URL, signInTo, USER } from './support/accounts';

import type { Page } from '@playwright/test';

const expectNoAxeViolation = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`))
    .toEqual([]);
};

/** A workspace of its own for a test, named after Demo so that Demo stays the first one by name. */
const createWorkspace = async (page: Page, url = DEMO_URL) => {
  const slug = `lab-${String(Date.now())}-${String(Math.floor(Math.random() * 1000))}`;
  const response = await page.request.post(`${url}/api/workspaces`, { data: { name: `Lab ${slug}`, slug } });
  expect(response.status()).toBe(201);
  return { name: `Lab ${slug}`, slug };
};

const switcher = (page: Page, name: string) => page.getByRole('button', { name: `Workspace: ${name}` });

test.describe('workspaces', () => {
  test('given the demo, /w/demo/graph and /w/demo/trace show its traffic and trace, with no axe violation (18)', async ({ page }) => {
    await page.goto('/w/demo/graph');
    await expect(page.locator('.vue-flow__edge')).toHaveCount(9);
    await expect(page).toHaveTitle('Traffic · Demo · Stackmap');
    await expectNoAxeViolation(page);

    await page.goto('/w/demo/trace?hostname=app.homelab.example&client=public&view=list');
    await expect(page.getByRole('status').filter({ hasText: 'app.homelab.example from the Internet' })).toHaveCount(1);
    await expectNoAxeViolation(page);
  });

  test('given /graph or /trace?hostname=…, leads to /w/<slug>/… with the same query, the last workspace used first (19)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(`${DEMO_URL}/w/demo/graph`);
    await page.goto('/trace?hostname=app.homelab.example&client=public');
    await expect(page).toHaveURL(`${DEMO_URL}/w/demo/trace?hostname=app.homelab.example&client=public`);

    const lab = await createWorkspace(page);
    await page.goto(`/w/${lab.slug}/graph`);
    await expect(page.getByText('Nothing to draw yet')).toBeVisible();
    await page.goto('/graph?view=list');
    await expect(page).toHaveURL(`${DEMO_URL}/w/${lab.slug}/graph?view=list`);
  });

  test('given a slug that is unknown or not theirs, the page says Workspace not found and links to their first workspace (21)', async ({ page }) => {
    await page.goto('/w/nowhere/trace');
    await expect(page).toHaveTitle('Workspace not found · Stackmap');
    await expect(page.getByRole('heading', { name: 'Workspace not found' })).toBeFocused();
    // No control that could do nothing here.
    await expect(page.getByRole('combobox', { name: 'Hostname' })).toHaveCount(0);

    await page.goto('/w/nowhere/graph');
    await expect(page.getByRole('heading', { name: 'Workspace not found' })).toBeFocused();
    await expect(page.getByRole('radiogroup', { name: 'View' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Workspace not found' })).toBeVisible();
    await expect(page.getByText('It doesn’t exist, or you aren’t a member.')).toBeVisible();
    await page.getByRole('link', { name: 'Go to Demo' }).click();
    await expect(page).toHaveURL(`${DEMO_URL}/w/demo/graph`);
  });

  test('given the switcher, its menu lists the workspaces with the current one marked, and choosing one keeps the view (22)', async ({ page }) => {
    const lab = await createWorkspace(page);
    await page.goto('/w/demo/trace');

    await switcher(page, 'Demo').click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: /^Demo, owner/ })).toHaveAttribute('aria-current', 'page');
    await expect(menu.getByRole('menuitem', { name: 'Create a workspace' })).toBeVisible();
    await expectNoAxeViolation(page);
    await menu.getByRole('menuitem', { name: `${lab.name}, owner` }).click();

    await expect(page).toHaveURL(`${DEMO_URL}/w/${lab.slug}/trace`);
    await expect(switcher(page, lab.name)).toBeVisible();
  });

  test('given /workspaces/new, a name fills the slug, and creating leads to the new empty workspace, with no axe violation (23)', async ({ page }) => {
    const slug = `home-${String(Date.now())}`;
    await page.goto('/workspaces/new');
    await expect(page.getByRole('heading', { level: 1, name: 'New workspace' })).toBeVisible();
    await expectNoAxeViolation(page);

    await page.getByRole('textbox', { name: /^Name/ }).fill(`Home ${slug.slice(5)}`);
    await expect(page.getByRole('textbox', { name: 'Short name' })).toHaveValue(slug);
    await page.getByRole('button', { name: 'Create workspace' }).click();

    await expect(page).toHaveURL(`${DEMO_URL}/w/${slug}/graph`);
    // Said by a toast, which outlives the page that created the workspace.
    await expect(page.getByText(`Workspace “Home ${slug.slice(5)}” created`, { exact: true })).toBeVisible();
    await expect(page.getByText('Nothing to draw yet')).toBeVisible();
    await expect(switcher(page, `Home ${slug.slice(5)}`)).toBeVisible();
  });

  test('given a taken slug, the form shows the error on the slug field and focuses it (24)', async ({ page }) => {
    await page.goto('/workspaces/new');
    await page.getByRole('textbox', { name: /^Name/ }).fill('Demo');
    await page.getByRole('button', { name: 'Create workspace' }).click();

    const slug = page.getByRole('textbox', { name: 'Short name' });
    await expect(slug).toBeFocused();
    await expect(slug).toHaveAccessibleDescription(/Another workspace already uses this short name\./);
  });

  test('given a user who is not the administrator, /workspaces/new says only an administrator can create workspaces (25)', async ({ page }) => {
    await signInTo(page, DEMO_URL, USER);
    await page.goto('/workspaces/new');

    await expect(page.getByText('Only an administrator can create workspaces.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^Name/ })).toHaveCount(0);
  });

  test('given the Traffic panel, trace links point to /w/<slug>/trace (26)', async ({ page }) => {
    await page.goto('/w/demo/graph?view=list');
    await page.getByRole('table', { name: /^Home server/ }).getByRole('button', { name: 'Nginx Proxy Manager' }).first()
      .click();
    const panel = page.getByRole('complementary');
    await panel.getByRole('button', { name: /443\/tcp/ }).first().click();

    await expect(panel.getByRole('link', { name: 'Trace app.homelab.example from the Internet' }))
      .toHaveAttribute('href', '/w/demo/trace?hostname=app.homelab.example&client=public');
  });
});

test.describe('workspaces, without one', () => {
  test.use({ baseURL: EMPTY_URL });

  test('given no workspace, /graph says so, with Create a workspace for the administrator and an invitation hint for others (20)', async ({ page }) => {
    await signInTo(page, EMPTY_URL);
    await page.goto('/graph');
    await expect(page.getByRole('heading', { name: 'No workspace yet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create a workspace' })).toHaveAttribute('href', '/workspaces/new');
    await expectNoAxeViolation(page);

    await signInTo(page, EMPTY_URL, USER);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'No workspace yet' })).toBeVisible();
    await expect(page.getByText('Ask an administrator to invite you to a workspace.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create a workspace' })).toHaveCount(0);
  });

  test('given no workspace, a workspace link says how to get one rather than a dead end', async ({ page }) => {
    await signInTo(page, EMPTY_URL);
    await page.goto('/w/demo/graph');

    await expect(page.getByRole('heading', { name: 'No workspace yet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create a workspace' })).toBeVisible();
  });

  test('given the workspaces cannot be loaded, /graph says so; Try again loads them and focus goes to the heading', async ({ page }) => {
    await signInTo(page, EMPTY_URL);
    // Every request fails until Try again: the client retries a failed request once by itself.
    let failing = true;
    await page.route('**/api/workspaces', async (route) => {
      await (failing ? route.abort() : route.fallback());
    });
    await page.goto('/graph');

    await expect(page.getByRole('alert')).toHaveText(/Your workspaces could not be loaded\./);
    failing = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'No workspace yet' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });
});
