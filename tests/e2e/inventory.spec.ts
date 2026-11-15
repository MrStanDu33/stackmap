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

/** A workspace of the test's own, owned by the administrator: the demo's stays as the other tests read it. */
const createWorkspace = async (page: Page) => {
  const slug = `inventory-${String(Date.now())}-${String(Math.floor(Math.random() * 1000))}`;
  const response = await page.request.post(`${DEMO_URL}/api/workspaces`, { data: { name: `Inventory ${slug}`, slug } });
  expect(response.status()).toBe(201);
  return { ...(await response.json() as { id: string }), slug };
};

/** An entity created through the API, as the owner: its id. */
const createEntity = async (page: Page, workspaceId: string, type: string, data: Record<string, unknown>) => {
  const response = await page.request.post(`${DEMO_URL}/api/workspaces/${workspaceId}/entities/${type}`, { data });
  expect(response.status()).toBe(201);
  return (await response.json() as { id: string }).id;
};

const openHosts = async (page: Page, slug: string, query = '') => {
  await page.goto(`/w/${slug}/inventory/core/host${query}`);
  await hydrated(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Hosts' })).toBeVisible();
};

const pick = async (page: Page, field: string | RegExp, option: string) => {
  await page.getByRole('combobox', { name: field }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
};

test.describe('inventory', () => {
  test('the sidebar\'s Inventory link opens the sites, and the type navigation reaches the hosts (1, 2, 3)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await page.goto(`/w/${workspace.slug}/graph`);
    await hydrated(page);

    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Inventory' }).click();
    await expect(page).toHaveURL(`${DEMO_URL}/w/${workspace.slug}/inventory/core/site`);
    await expect(page.getByRole('heading', { level: 1, name: 'Sites' })).toBeVisible();

    await page.getByRole('navigation', { name: 'Entity types' }).getByRole('link', { name: 'Hosts' }).click();
    await expect(page).toHaveURL(`${DEMO_URL}/w/${workspace.slug}/inventory/core/host`);
    await expect(page.getByRole('link', { name: 'Hosts' })).toHaveAttribute('aria-current', 'page');
  });

  test('an unknown type says it is not in the inventory, with a link back (4)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await page.goto(`/w/${workspace.slug}/inventory/core/tunnel`);
    await hydrated(page);

    await expect(page.getByRole('heading', { level: 1, name: 'This type is not in the inventory' })).toBeVisible();
    await expect(page).toHaveTitle(/^This type is not in the inventory/);
    await page.getByRole('link', { name: 'Back to the inventory' }).click();
    await expect(page).toHaveURL(`${DEMO_URL}/w/${workspace.slug}/inventory/core/site`);
  });

  test('an editor creates a host with an address, and it is announced and listed (20, 21, 39)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await openHosts(page, workspace.slug);

    await page.getByRole('button', { name: 'New Host' }).click();
    const dialog = page.getByRole('dialog', { name: 'New Host' });
    await expect(dialog.getByRole('textbox', { name: /^Name/ })).toBeFocused();
    await dialog.getByRole('textbox', { name: /^Name/ }).fill('nas');
    await pick(page, /^Kind/, 'Physical server');
    await dialog.getByRole('button', { name: 'Add an address' }).click();
    await dialog.getByRole('textbox', { name: /^Address 1/ }).fill('192.0.2.10');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status')).toHaveText('nas created');
    const row = page.getByRole('table', { name: /Hosts/ }).getByRole('row', { name: /nas/ });
    await expect(row).toContainText('Physical server');
    await expect(row).toContainText('192.0.2.10');
    await expect(page.getByRole('button', { name: 'New Host' })).toBeFocused();
  });

  test('an invalid address shows its translated issue under the field, and the summary links to it (25, 27)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await openHosts(page, workspace.slug);

    await page.getByRole('button', { name: 'New Host' }).click();
    const dialog = page.getByRole('dialog', { name: 'New Host' });
    await dialog.getByRole('textbox', { name: /^Name/ }).fill('nas');
    await pick(page, /^Kind/, 'Physical server');
    await dialog.getByRole('button', { name: 'Add an address' }).click();
    const address = dialog.getByRole('textbox', { name: /^Address 1/ });
    await address.fill('192.0.2.300');
    await dialog.getByRole('button', { name: 'Save' }).click();

    const summary = dialog.getByRole('alert');
    await expect(summary).toBeFocused();
    await expect(summary).toContainText('The Host could not be saved');
    await expect(address).toHaveAttribute('aria-invalid', 'true');
    await expect(address).toHaveAccessibleDescription(/address/i);
    await summary.getByRole('link').first().click();
    await expect(address).toBeFocused();
  });

  test('an editor edits the host, and only the changed field is sent (22, 23, 24)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await createEntity(page, workspace.id, 'core/host', { name: 'nas', kind: 'physical', os: 'Debian 12' });
    await openHosts(page, workspace.slug);

    await page.getByRole('button', { name: 'Edit nas' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit nas' });
    await expect(dialog.getByRole('textbox', { name: /^Operating system/ })).toHaveValue('Debian 12');
    await dialog.getByRole('textbox', { name: /^Operating system/ }).fill('Debian 13');
    const patch = page.waitForRequest((request) => request.method() === 'PATCH');
    await dialog.getByRole('button', { name: 'Save' }).click();

    expect((await patch).postDataJSON()).toEqual({ os: 'Debian 13' });
    await expect(page.getByRole('status')).toHaveText('nas saved');
    await expect(page.getByRole('button', { name: 'Edit nas' })).toBeFocused();
  });

  test('closing with unsaved changes asks to discard them (33)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await openHosts(page, workspace.slug);

    await page.getByRole('button', { name: 'New Host' }).click();
    const dialog = page.getByRole('dialog', { name: 'New Host' });
    await dialog.getByRole('textbox', { name: /^Name/ }).fill('nas');
    await page.keyboard.press('Escape');

    const question = page.getByRole('alertdialog', { name: 'Discard your changes?' });
    await question.getByRole('button', { name: 'Keep editing' }).click();
    await expect(dialog.getByRole('textbox', { name: /^Name/ })).toHaveValue('nas');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await question.getByRole('button', { name: 'Discard' }).click();
    await expect(dialog).toBeHidden();
  });

  test('deleting a site that a host uses lists the host as a dependent (45, 47)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    const siteId = await createEntity(page, workspace.id, 'core/site', { name: 'Home' });
    await createEntity(page, workspace.id, 'core/host', { name: 'nas', kind: 'physical', siteId });
    await page.goto(`/w/${workspace.slug}/inventory/core/site`);
    await hydrated(page);

    await page.getByRole('button', { name: 'Delete Home' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Delete Home? This cannot be undone.');
    await dialog.getByRole('button', { name: 'Delete Home' }).click();

    await expect(dialog.getByRole('alert')).toContainText('Home is still used by:');
    await expect(dialog.getByRole('alert').getByRole('listitem')).toHaveText(['1 Host']);
  });

  test('an editor deletes the host after confirming, and focus goes to the table\'s heading (46)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await createEntity(page, workspace.id, 'core/host', { name: 'nas', kind: 'physical' });
    await openHosts(page, workspace.slug);

    await page.getByRole('button', { name: 'Delete nas' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete nas' }).click();

    await expect(page.getByRole('status')).toHaveText('nas deleted');
    await expect(page.getByRole('heading', { level: 1, name: 'Hosts' })).toBeFocused();
    await expect(page.getByText('No Hosts yet')).toBeVisible();
  });

  test('a viewer sees no New, Edit or Delete, and opens a row read-only (18)', async ({ page, browser }) => {
    const workspace = await createWorkspace(page);
    await createEntity(page, workspace.id, 'core/host', { name: 'nas', kind: 'physical' });
    const invitation = await page.request.post(`${DEMO_URL}/api/workspaces/${workspace.id}/invitations`, { data: { email: USER.email, role: 'viewer' } });
    const link = (await invitation.json() as { url: string }).url;
    const context = await browser.newContext({ baseURL: DEMO_URL, storageState: { cookies: [], origins: [] } });
    const viewer = await context.newPage();
    await signInTo(viewer, DEMO_URL, USER);
    expect((await viewer.request.post(`${DEMO_URL}/api${link.replace('/invite/', '/invitations/')}/accept`)).status()).toBe(200);

    await openHosts(viewer, workspace.slug);
    await expect(viewer.getByRole('button', { name: 'New Host' })).toHaveCount(0);
    await expect(viewer.getByRole('button', { name: 'Edit nas' })).toHaveCount(0);
    await expect(viewer.getByRole('button', { name: 'Delete nas' })).toHaveCount(0);
    await viewer.getByRole('button', { name: 'nas' }).click();
    const dialog = viewer.getByRole('dialog', { name: 'nas' });
    await expect(dialog.getByRole('textbox', { name: /^Name/ })).toHaveAttribute('readonly');
    await expect(dialog.getByRole('button', { name: 'Save' })).toHaveCount(0);
    await expectNoAxeViolation(viewer);
    await context.close();
  });

  test('search, sort and filters stay in the URL and survive a reload (9, 11)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await createEntity(page, workspace.id, 'core/host', { name: 'nas', kind: 'physical', tags: ['storage'] });
    await createEntity(page, workspace.id, 'core/host', { name: 'backup', kind: 'vm' });
    await openHosts(page, workspace.slug);

    await page.getByRole('searchbox', { name: 'Search' }).fill('storage');
    await expect(page).toHaveURL(/[?&]q=storage/);
    await expect(page.getByRole('status')).toHaveText('1 result');
    await page.getByRole('button', { name: 'Sort by Kind' }).click();
    await expect(page).toHaveURL(/[?&]sort=kind/);

    await page.reload();
    await hydrated(page);
    await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('storage');
    await expect(page.getByRole('columnheader', { name: /Kind/ })).toHaveAttribute('aria-sort', 'ascending');
    await expect(page.getByRole('table', { name: /Hosts/ }).getByRole('row')).toHaveCount(2);
  });

  test('the Traffic view shows translated kinds (6)', async ({ page }) => {
    await page.goto('/graph?view=list');
    await hydrated(page);

    await expect(page.getByRole('table', { name: /Home server/ }).locator('caption')).toContainText('Physical server');
  });

  test('has no axe violation: table, slide-over with issues, delete dialog', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await createEntity(page, workspace.id, 'core/host', { name: 'nas', kind: 'physical' });
    await openHosts(page, workspace.slug);
    await expectNoAxeViolation(page);

    await page.getByRole('button', { name: 'New Host' }).click();
    await page.getByRole('dialog', { name: 'New Host' }).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog', { name: 'New Host' }).getByRole('alert')).toBeVisible();
    await expectNoAxeViolation(page);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Delete nas' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expectNoAxeViolation(page);
  });
});
