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

/**
 * A workspace of the test's own: an edge router forwarding 203.0.113.10:443 to a web server's listener (a flow), and
 * :8080 to nothing (an orphan once NAT is off), with app.homelab.example pointing at the router. NAT is then off.
 */
const createWorkspace = async (page: Page) => {
  const slug = `hidden-${String(Date.now())}-${String(Math.floor(Math.random() * 1000))}`;
  const created = await page.request.post(`${DEMO_URL}/api/workspaces`, { data: { name: `Team ${slug}`, slug } });
  expect(created.status()).toBe(201);
  const { id } = await created.json() as { id: string };
  const make = async (type: string, data: object) => {
    const response = await page.request.post(`${DEMO_URL}/api/workspaces/${id}/entities/${type}`, { data });
    expect(response.status(), type).toBe(201);
    return (await response.json() as { id: string }).id;
  };
  const router = await make('core/host', { name: 'Edge router', kind: 'router', addresses: [{ address: '203.0.113.10' }] });
  const server = await make('core/host', { name: 'Web server', kind: 'vm', addresses: [{ address: '10.0.10.20' }] });
  const web = await make('core/service', { name: 'Website', kind: 'app', hostId: server });
  await make('core/listener', { serviceId: web, port: 443, transport: 'tcp' });
  const domain = await make('core/domain', { name: 'homelab.example' });
  await make('core/dns-record', { domainId: domain, name: 'app', type: 'A', value: '203.0.113.10' });
  for (const port of [443, 8080]) {
    await make('nat/port-forward', {
      hostId: router, externalAddress: '203.0.113.10', externalPort: port, transport: 'tcp', internalAddress: '10.0.10.20', internalPort: port,
    });
  }
  const off = await page.request.put(`${DEMO_URL}/api/workspaces/${id}/extensions/nat`, { data: { enabled: false } });
  expect(off.status()).toBe(200);
  return { id, slug };
};

test.describe('hidden entities', () => {
  test('given NAT off, Traffic shows its flow said hidden, and its panel has no names (4, 5)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await page.goto(`/w/${workspace.slug}/graph?view=list`);
    await hydrated(page);

    const hidden = page.getByRole('table', { name: /Web server/ }).getByText('Hidden: Router and NAT is turned off');
    await expect(hidden).toHaveCount(1);
    await expectNoAxeViolation(page);
  });

  test('given NAT off, a trace through a port forward says the hop is hidden (6, 8)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await page.goto(`/w/${workspace.slug}/trace?hostname=app.homelab.example&client=public&view=list`);
    await hydrated(page);

    await page.getByRole('button', { name: /^From Internet to Website/ }).first().click();
    await expect(page.getByRole('complementary').getByText('Hidden: Router and NAT is turned off')).toBeVisible();
  });

  test('given NAT off, an admin reviews the disconnected port forwards, keeps one hidden and deletes another, with no axe violation (19, 20, 21)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    // A second disconnected forward, so both actions have one.
    const router = (await (await page.request.get(`${DEMO_URL}/api/workspaces/${workspace.id}/entities/core/host`)).json() as {
      items: { id: string; name: string }[];
    }).items.find(({ name }) => name === 'Edge router')?.id;
    await page.request.put(`${DEMO_URL}/api/workspaces/${workspace.id}/extensions/nat`, { data: { enabled: true } });
    await page.request.post(`${DEMO_URL}/api/workspaces/${workspace.id}/entities/nat/port-forward`, {
      data: { hostId: router, externalAddress: '203.0.113.10', externalPort: 8443, transport: 'tcp', internalAddress: '10.0.10.20', internalPort: 8443 },
    });
    await page.request.put(`${DEMO_URL}/api/workspaces/${workspace.id}/extensions/nat`, { data: { enabled: false } });

    await page.goto(`/w/${workspace.slug}/extensions`);
    await hydrated(page);
    const nat = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Router and NAT' }) });
    await expect(nat).toContainText('2 hidden entities no longer connect to anything');
    await nat.getByRole('button', { name: 'Review' }).click();
    await expectNoAxeViolation(page);

    await nat.getByRole('button', { name: /^Keep Edge router 203\.0\.113\.10:8080\/tcp hidden$/ }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Edge router 203.0.113.10:8080/tcp kept hidden' })).toHaveCount(1);
    await expect(nat.getByRole('button', { name: /^Delete Edge router 203\.0\.113\.10:8443\/tcp$/ })).toBeFocused();

    await nat.getByRole('button', { name: /^Delete Edge router 203\.0\.113\.10:8443\/tcp$/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: /^Delete / }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Edge router 203.0.113.10:8443/tcp deleted' })).toHaveCount(1);
    await expect(nat).not.toContainText('no longer connect');
  });

  test('given NAT off, a viewer sees the count of disconnected entities as text only (22)', async ({ page, browser }) => {
    const workspace = await createWorkspace(page);
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

    const nat = viewer.getByRole('listitem').filter({ has: viewer.getByRole('heading', { name: 'Router and NAT' }) });
    await expect(nat).toContainText('1 hidden entity no longer connects to anything');
    await expect(nat.getByRole('button')).toHaveCount(0);
    await context.close();
  });
});
