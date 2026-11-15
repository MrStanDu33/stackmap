import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { acceptInvitation, DEMO_URL, signInTo, USER } from './support/accounts';
import { hydrated } from './support/hydration';

import type { Page } from '@playwright/test';

const expectNoAxeViolation = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`))
    .toEqual([]);
};

const NAT = 'Does a router forward ports from the internet to your machines?';
const PROXY = 'Do you serve sites through a reverse proxy, such as Nginx Proxy Manager, Traefik or Caddy?';

const uniqueSlug = () => `stack-${String(Date.now())}-${String(Math.floor(Math.random() * 1000))}`;

/** Creates a workspace through /workspaces/new, as an admin does: it lands on onboarding. */
const createThroughForm = async (page: Page) => {
  const slug = uniqueSlug();
  await page.goto('/workspaces/new');
  await hydrated(page);
  await page.getByRole('textbox', { name: /^Name/ }).fill(`Stack ${slug.slice(6)}`);
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(`${DEMO_URL}/w/${slug}/onboarding`);
  await hydrated(page);
  return slug;
};

/** A workspace created through the API, for the tests that start on its onboarding page. */
const createWorkspace = async (page: Page) => {
  const slug = uniqueSlug();
  const created = await page.request.post(`${DEMO_URL}/api/workspaces`, { data: { name: `Stack ${slug}`, slug } });
  expect(created.status()).toBe(201);
  return { id: (await created.json() as { id: string }).id, slug };
};

const extensionSwitch = (page: Page, name: string) => page.getByRole('switch', { name });

test.describe('onboarding', () => {
  test('given an admin creating a workspace, the creation toast shows and "What\'s in your stack?" opens with every item unchecked under its question, with no axe violation (16, 17′, 26)', async ({ page }) => {
    await createThroughForm(page);

    await expect(page.getByText(/^Workspace “Stack .+” created$/)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'What\'s in your stack?' })).toBeVisible();
    await expect(page.getByRole('group', { name: NAT }).getByRole('checkbox', { name: 'Port forwards' })).not.toBeChecked();
    const proxy = page.getByRole('group', { name: PROXY });
    await expect(proxy.getByRole('checkbox', { name: 'Proxy routes' })).not.toBeChecked();
    await expect(proxy.getByRole('checkbox', { name: 'Reverse proxy' })).not.toBeChecked();
    await expectNoAxeViolation(page);
  });

  test('given Port forwards picked, Continue says the stack is set up and opens the graph; the Extensions page shows NAT on and reverse proxy off, and the inventory offers port forwards but not proxy routes (19′, 27)', async ({ page }) => {
    const slug = await createThroughForm(page);

    await page.getByRole('checkbox', { name: 'Port forwards' }).check();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText('Your stack is set up', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(`${DEMO_URL}/w/${slug}/graph`);

    await page.goto(`/w/${slug}/extensions`);
    await hydrated(page);
    await expect(extensionSwitch(page, 'Router and NAT')).toBeChecked();
    await expect(extensionSwitch(page, 'Reverse proxy')).not.toBeChecked();

    await page.goto(`/w/${slug}/inventory`);
    await hydrated(page);
    const types = page.getByRole('navigation', { name: 'Entity types' });
    await expect(types.getByRole('link', { name: 'Port forwards' })).toBeVisible();
    await expect(types.getByRole('link', { name: 'Proxy routes' })).toHaveCount(0);
  });

  test('given Skip for now, the graph opens and every extension stays on (21)', async ({ page }) => {
    const slug = await createThroughForm(page);

    await page.getByRole('checkbox', { name: 'Port forwards' }).check();
    await page.getByRole('button', { name: 'Skip for now' }).click();

    await expect(page).toHaveURL(`${DEMO_URL}/w/${slug}/graph`);
    await page.goto(`/w/${slug}/extensions`);
    await hydrated(page);
    await expect(extensionSwitch(page, 'Router and NAT')).toBeChecked();
    await expect(extensionSwitch(page, 'Reverse proxy')).toBeChecked();
  });

  test('given a workspace that already has data, Continue says so and links to the Extensions page (22)', async ({ page }) => {
    const { id, slug } = await createWorkspace(page);
    const host = await page.request.post(`${DEMO_URL}/api/workspaces/${id}/entities/core/host`, {
      data: { name: 'Web server', kind: 'vm', addresses: [{ address: '10.0.10.20' }] },
    });
    expect(host.status()).toBe(201);
    await page.goto(`/w/${slug}/onboarding`);
    await hydrated(page);

    await page.getByRole('button', { name: 'Continue' }).click();

    const alert = page.getByRole('alert').filter({ hasText: 'This workspace already has data' });
    await expect(alert.getByRole('link', { name: 'Extensions page' })).toHaveAttribute('href', `/w/${slug}/extensions`);
  });

  test('given a viewer, the page says only admins and owners can set up the workspace and links to the graph (24)', async ({ page, browser }) => {
    const { id, slug } = await createWorkspace(page);
    const invited = await page.request.post(`${DEMO_URL}/api/workspaces/${id}/invitations`, {
      data: { email: USER.email, role: 'viewer' },
    });
    const { url: link } = await invited.json() as { url: string };
    const context = await browser.newContext({ baseURL: DEMO_URL, storageState: { cookies: [], origins: [] } });
    const viewer = await context.newPage();
    await signInTo(viewer, DEMO_URL, USER);
    expect(await acceptInvitation(viewer, link)).toBe(200);

    await viewer.goto(`/w/${slug}/onboarding`);
    await hydrated(viewer);

    await expect(viewer.getByText('Only administrators and owners can set up this workspace.')).toBeVisible();
    await expect(viewer.getByRole('link', { name: 'Go to the graph' })).toHaveAttribute('href', `/w/${slug}/graph`);
    await expect(viewer.getByRole('checkbox')).toHaveCount(0);
    await context.close();
  });

  test('when the extensions cannot be loaded, the page says so, and Try again recovers with the focus on the heading (review)', async ({ page }) => {
    const { slug } = await createWorkspace(page);
    await page.route('**/api/workspaces/*/extensions', (route) => route.abort());
    await page.goto(`/w/${slug}/onboarding`);
    await hydrated(page);
    await expect(page.getByRole('alert')).toContainText('This page could not be loaded.');

    await page.unroute('**/api/workspaces/*/extensions');
    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByRole('checkbox', { name: 'Port forwards' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'What\'s in your stack?' })).toBeFocused();
  });

  test('given a slug that is unknown, the page says Workspace not found and moves the focus there (review)', async ({ page }) => {
    await page.goto('/w/no-such-workspace/onboarding');
    await hydrated(page);

    await expect(page.getByRole('heading', { name: 'Workspace not found' })).toBeFocused();
  });
});
