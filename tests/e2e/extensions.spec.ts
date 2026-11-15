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

/** A workspace of the test's own on the demo server, owned by the administrator, with a router forwarding 2 ports. */
const createWorkspace = async (page: Page) => {
  const slug = `ext-${String(Date.now())}-${String(Math.floor(Math.random() * 1000))}`;
  const created = await page.request.post(`${DEMO_URL}/api/workspaces`, { data: { name: `Team ${slug}`, slug } });
  expect(created.status()).toBe(201);
  const { id } = await created.json() as { id: string };
  const entities = `${DEMO_URL}/api/workspaces/${id}/entities`;
  const router = await page.request.post(`${entities}/core/host`, {
    data: { name: 'Edge router', kind: 'router', addresses: [{ address: '203.0.113.10' }] },
  });
  expect(router.status()).toBe(201);
  const { id: hostId } = await router.json() as { id: string };
  for (const port of [443, 8080]) {
    const forward = await page.request.post(`${entities}/nat/port-forward`, {
      data: { hostId, externalAddress: '203.0.113.10', externalPort: port, transport: 'tcp', internalAddress: '10.0.10.20', internalPort: port },
    });
    expect(forward.status()).toBe(201);
  }
  return { id, slug };
};

const setNat = async (page: Page, workspaceId: string, enabled: boolean) => {
  const response = await page.request.put(`${DEMO_URL}/api/workspaces/${workspaceId}/extensions/nat`, { data: { enabled } });
  expect(response.status()).toBe(200);
};

test.describe('workspace extensions', () => {
  test('given /w/<slug>/extensions, a viewer sees every extension On or Off as text, with no switch (24, 25)', async ({ page, browser }) => {
    const workspace = await createWorkspace(page);
    await setNat(page, workspace.id, false);
    const invited = await page.request.post(`${DEMO_URL}/api/workspaces/${workspace.id}/invitations`, {
      data: { email: USER.email, role: 'viewer' },
    });
    const { url: link } = await invited.json() as { url: string };
    const context = await browser.newContext({ baseURL: DEMO_URL, storageState: { cookies: [], origins: [] } });
    const viewer = await context.newPage();
    await signInTo(viewer, DEMO_URL, USER);
    expect((await viewer.request.post(`${DEMO_URL}/api${new URL(link, DEMO_URL).pathname.replace('/invite/', '/invitations/')}/accept`)).status()).toBe(200);

    await viewer.goto(`/w/${workspace.slug}/extensions`);
    await hydrated(viewer);

    await expect(viewer).toHaveTitle(`Extensions · Team ${workspace.slug} · Stackmap`);
    await expect(viewer.getByRole('heading', { level: 1, name: 'Extensions' })).toBeVisible();
    const nat = viewer.getByRole('listitem').filter({ has: viewer.getByRole('heading', { name: 'Router and NAT' }) });
    await expect(nat).toContainText('Off');
    await expect(viewer.getByRole('listitem').filter({ has: viewer.getByRole('heading', { name: 'Core' }) })).toContainText('Always on');
    await expect(viewer.getByRole('switch')).toHaveCount(0);
    await expectNoAxeViolation(viewer);
    await context.close();
  });

  test('given an owner, turning NAT off confirms what stays hidden, announces it and returns focus to the switch, with no axe violation (26, 27, 28)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await page.goto(`/w/${workspace.slug}/extensions`);
    await hydrated(page);
    const nat = page.getByRole('switch', { name: 'Router and NAT' });
    await expect(nat).toBeChecked();
    await expectNoAxeViolation(page);

    await nat.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByRole('heading', { name: 'Turn off Router and NAT?' })).toBeVisible();
    await expect(dialog).toContainText('Port forwards: 2');
    await expect(dialog).toContainText('Nothing is deleted.');
    await expectNoAxeViolation(page);
    // Escape cancels: the switch stays on, and gets the focus back.
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(nat).toBeChecked();
    await expect(nat).toBeFocused();

    await nat.press('Space');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Turn off' }).click();

    await expect(nat).not.toBeChecked();
    await expect(nat).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: 'Router and NAT turned off' })).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Router and NAT' })).not.toBeChecked();
  });

  test('given an owner, turning NAT on needs no confirmation, and a failed save puts the switch back (29, 32)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await setNat(page, workspace.id, false);
    await page.goto(`/w/${workspace.slug}/extensions`);
    await hydrated(page);
    const nat = page.getByRole('switch', { name: 'Router and NAT' });

    await page.route('**/extensions/nat', (route) => route.fulfill({ status: 500, body: '' }));
    await nat.click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('alert').filter({ hasText: 'Router and NAT could not be changed. Try again.' })).toHaveCount(1);
    await expect(nat).not.toBeChecked();

    await page.unroute('**/extensions/nat');
    await nat.click();
    await expect(nat).toBeChecked();
    await expect(page.getByRole('status').filter({ hasText: 'Router and NAT turned on' })).toHaveCount(1);
  });

  test('given NAT off, the inventory hides Port forwards and its URL says the extension is turned off, with a link to manage extensions (35, 36)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await setNat(page, workspace.id, false);

    await page.goto(`/w/${workspace.slug}/inventory`);
    await hydrated(page);
    await expect(page.getByRole('link', { name: 'Hosts' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Port forwards' })).toHaveCount(0);

    await page.goto(`/w/${workspace.slug}/inventory/nat/port-forward`);
    await hydrated(page);
    await expect(page.getByText('This type\'s extension is turned off in this workspace.')).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
    await page.getByRole('link', { name: 'Manage extensions' }).click();
    await expect(page).toHaveURL(`${DEMO_URL}/w/${workspace.slug}/extensions`);
  });

  test('given NAT off then back on, the port forwards are back in the inventory, unchanged (19, 29)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await setNat(page, workspace.id, false);
    await setNat(page, workspace.id, true);

    await page.goto(`/w/${workspace.slug}/inventory/nat/port-forward`);
    await hydrated(page);

    await expect(page.getByRole('table').getByRole('row')).toHaveCount(3);
  });

  test('given the sidebar, every member reaches the Extensions page, marked current on it (34)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await page.goto(`/w/${workspace.slug}/graph`);
    await hydrated(page);

    await page.getByRole('navigation').getByRole('link', { name: 'Extensions' }).click();

    await expect(page).toHaveURL(`${DEMO_URL}/w/${workspace.slug}/extensions`);
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Extensions' })).toHaveAttribute('aria-current', 'page');
  });
});
