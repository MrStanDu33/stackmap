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

/** The live region that announces this text: the page has others, Nuxt's route announcer among them. */
const announced = (page: Page, text: string) => page.getByRole('status')
  .filter({ hasText: new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) });

/**
 * Records every announcement made while its live region is hidden from assistive technologies (by a modal's
 * aria-hidden or inert): screen readers do not read those (review).
 */
const watchHiddenAnnouncements = (page: Page) => page.evaluate(() => {
  const hidden: string[] = [];
  (window as unknown as { hiddenAnnouncements: string[] }).hiddenAnnouncements = hidden;
  new MutationObserver((records) => {
    for (const { target } of records) {
      const region = (target instanceof Element ? target : target.parentElement)?.closest('[role="status"], [role="alert"]');
      const text = region?.textContent.trim();
      if (region && text && region.closest('[aria-hidden="true"], [inert]')) {
        hidden.push(text);
      }
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
});
const hiddenAnnouncements = (page: Page) =>
  page.evaluate(() => (window as unknown as { hiddenAnnouncements: string[] }).hiddenAnnouncements);

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
    await watchHiddenAnnouncements(page);
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(dialog).toBeHidden();
    await expect(announced(page, 'nas created')).toBeAttached();
    const row = page.getByRole('table', { name: /Hosts/ }).getByRole('row', { name: /nas/ });
    await expect(row).toContainText('Physical server');
    await expect(row).toContainText('192.0.2.10');
    await expect(page.getByRole('button', { name: 'New Host' })).toBeFocused();
    expect(await hiddenAnnouncements(page)).toEqual([]);
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
    await expect(summary).toContainText('Not saved');
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
    await expect(announced(page, 'nas saved')).toBeAttached();
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
    await watchHiddenAnnouncements(page);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete nas' }).click();

    await expect(announced(page, 'nas deleted')).toBeAttached();
    await expect(page.getByRole('heading', { level: 1, name: 'Hosts' })).toBeFocused();
    await expect(page.getByText('Nothing here yet')).toBeVisible();
    expect(await hiddenAnnouncements(page)).toEqual([]);
  });

  test('when the extensions cannot be loaded, the inventory says so in the app\'s frame, and Retry recovers (review)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await page.route('**/api/extensions', (route) => route.abort());
    await page.goto(`/w/${workspace.slug}/inventory`);
    await hydrated(page);

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: 'Inventory' })).toBeVisible();
    await expect(main.getByRole('alert')).toContainText('could not be loaded');
    await page.unroute('**/api/extensions');
    await main.getByRole('button', { name: 'Retry' }).click();
    await expect(page).toHaveURL(`${DEMO_URL}/w/${workspace.slug}/inventory/core/site`);
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
    await expect(announced(page, '1 result')).toBeAttached();
    // Named by its column: the header's aria-sort says the order (review).
    await page.getByRole('table', { name: /Hosts/ }).getByRole('button', { name: 'Kind', exact: true }).click();
    await expect(page).toHaveURL(/[?&]sort=kind/);

    await page.reload();
    await hydrated(page);
    await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('storage');
    await expect(page.getByRole('columnheader', { name: /Kind/ })).toHaveAttribute('aria-sort', 'ascending');
    await expect(page.getByRole('table', { name: /Hosts/ }).getByRole('row')).toHaveCount(2);
  });

  test('a DNS record\'s view shows translated in the table, not its raw value (review)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    const domainId = await createEntity(page, workspace.id, 'core/domain', { name: 'homelab.example' });
    await createEntity(page, workspace.id, 'core/dns-record', { domainId, name: 'nas', type: 'A', value: '192.0.2.10', view: 'internal' });
    await page.goto(`/w/${workspace.slug}/inventory/core/dns-record`);
    await hydrated(page);

    const row = page.getByRole('table', { name: /DNS records/ }).getByRole('row', { name: /nas/ });
    await expect(row.getByRole('cell', { name: 'Internal', exact: true })).toBeVisible();
  });

  test('the Traffic view shows translated kinds (6)', async ({ page }) => {
    await page.goto('/graph?view=list');
    await hydrated(page);

    await expect(page.getByRole('table', { name: /Home server/ }).locator('caption')).toContainText('Physical server');
  });

  test('an editor creates a port forward on the router, picking its address, and deletes it (9, 11, 16)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await createEntity(page, workspace.id, 'core/host', {
      name: 'Edge router', kind: 'router', addresses: [{ address: '203.0.113.10' }, { address: '192.0.2.1' }],
    });
    await page.goto(`/w/${workspace.slug}/inventory/nat/port-forward`);
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Port forwards' })).toBeVisible();

    await page.getByRole('button', { name: 'New Port forward' }).click();
    const dialog = page.getByRole('dialog', { name: 'New Port forward' });
    await pick(page, /^Host/, 'Edge router');
    await page.getByRole('combobox', { name: /^External address/ }).click();
    await expect(page.getByRole('option')).toHaveText(['203.0.113.10', '192.0.2.1']);
    await page.getByRole('option', { name: '203.0.113.10', exact: true }).click();
    await dialog.getByRole('spinbutton', { name: /^External port/ }).fill('443');
    await dialog.getByRole('textbox', { name: /^Internal address/ }).fill('192.0.2.10');
    await dialog.getByRole('spinbutton', { name: /^Internal port/ }).fill('8443');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(dialog).toBeHidden();
    const name = 'Edge router 203.0.113.10:443/tcp';
    await expect(announced(page, `${name} created`)).toBeAttached();
    const row = page.getByRole('table', { name: /Port forwards/ }).getByRole('row', { name: /203\.0\.113\.10:443/ });
    await expect(row).toContainText('192.0.2.10:8443');

    await page.getByRole('button', { name: `Delete ${name}` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: `Delete ${name}` }).click();
    await expect(announced(page, `${name} deleted`)).toBeAttached();
  });

  test('an editor creates a route with two hostnames, the second in text mode, and deletes it (6, 13, 18, 4)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    const hostId = await createEntity(page, workspace.id, 'core/host', { name: 'Home server', kind: 'physical' });
    const npm = await createEntity(page, workspace.id, 'core/service', { name: 'Nginx Proxy Manager', kind: 'reverse-proxy', hostId });
    const blog = await createEntity(page, workspace.id, 'core/service', { name: 'Blog', kind: 'app', hostId });
    await createEntity(page, workspace.id, 'core/listener', { serviceId: npm, port: 443, transport: 'tcp' });
    await createEntity(page, workspace.id, 'core/listener', { serviceId: blog, port: 3000, transport: 'tcp' });
    await page.goto(`/w/${workspace.slug}/inventory/reverse-proxy/route`);
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Proxy routes' })).toBeVisible();

    await page.getByRole('button', { name: 'New Proxy route' }).click();
    const dialog = page.getByRole('dialog', { name: 'New Proxy route' });
    await pick(page, /^Proxy/, 'Nginx Proxy Manager');
    await dialog.getByRole('textbox', { name: /^Hostname 1/ }).fill('blog.homelab.example');
    await dialog.getByRole('button', { name: 'Edit as text' }).click();
    await dialog.getByRole('textbox', { name: /^Hostnames, one per line/ }).press('End');
    await dialog.getByRole('textbox', { name: /^Hostnames, one per line/ }).pressSequentially('\nwww.blog.homelab.example');
    await pick(page, /^Upstream/, 'Blog :3000/tcp');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(dialog).toBeHidden();
    const name = 'Nginx Proxy Manager → blog.homelab.example (+1)';
    await expect(announced(page, `${name} created`)).toBeAttached();
    const row = page.getByRole('table', { name: /Proxy routes/ }).getByRole('row', { name: /www\.blog\.homelab\.example/ });
    await expect(row).toContainText('Blog :3000/tcp');
    await expect(row).toContainText('No');

    await page.getByRole('button', { name: `Delete ${name}` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: `Delete ${name}` }).click();
    await expect(announced(page, `${name} deleted`)).toBeAttached();
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
