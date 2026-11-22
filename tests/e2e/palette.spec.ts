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

// Chromium on Linux and Windows in CI: Ctrl. (macOS uses Cmd: unit tests cover it.)
const SHORTCUT = process.platform === 'darwin' ? 'Meta+k' : 'Control+k';
const LABEL = process.platform === 'darwin' ? '⌘K' : 'Ctrl+K';

/** Opens the palette on a page, with the focus in its field. */
const open = async (page: Page, url: string) => {
  await page.goto(url);
  await hydrated(page);
  await page.keyboard.press(SHORTCUT);
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await expect(dialog.getByRole('combobox', { name: 'Search' })).toBeFocused();
  return dialog;
};

test.describe('command palette', () => {
  test('given any signed-in page, the shortcut opens the Search dialog with the focus in its field, and Escape gives the focus back, with no axe violation (1)', async ({ page }) => {
    await page.goto('/settings');
    await hydrated(page);
    const traffic = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Traffic' });
    await traffic.focus();

    await page.keyboard.press(SHORTCUT);

    const dialog = page.getByRole('dialog', { name: 'Search' });
    await expect(dialog.getByRole('combobox', { name: 'Search' })).toBeFocused();
    await expectNoAxeViolation(page);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(traffic).toBeFocused();
  });

  test('given the sidebar, its Search button opens the palette, and closing it gives the focus back to the button, even after a click (1, review)', async ({ page }) => {
    await page.goto('/settings');
    await hydrated(page);
    const search = page.getByRole('button', { name: 'Search', exact: true });
    await expect(search).toContainText(LABEL);

    await search.click();
    await expect(page.getByRole('dialog', { name: 'Search' }).getByRole('combobox', { name: 'Search' })).toBeFocused();
    await page.keyboard.press('Escape');

    await expect(search).toBeFocused();
  });
});

test.describe('command palette groups', () => {
  const group = (dialog: ReturnType<Page['getByRole']>, name: string) => dialog.getByRole('group', { name });

  test('given an empty search, it lists pages, workspaces and actions; typing a host\'s name finds it among the entities (3, 4)', async ({ page }) => {
    const dialog = await open(page, '/w/demo/graph');
    await expect(group(dialog, 'Pages')).toBeVisible();
    await expect(group(dialog, 'Actions')).toBeVisible();
    await expect(group(dialog, 'Entities')).toHaveCount(0);

    await page.keyboard.type('Edge router');

    await expect(group(dialog, 'Entities').getByRole('option', { name: /^Edge router/ })).toBeVisible();
  });

  test('choosing a page opens it, choosing a workspace opens the same page there, the focus in its main content (5, 6, review)', async ({ page }) => {
    const lab = `lab-${String(Date.now())}`;
    expect((await page.request.post(`${DEMO_URL}/api/workspaces`, { data: { name: `Lab ${lab}`, slug: lab } })).status()).toBe(201);
    await open(page, '/w/demo/graph');
    await page.keyboard.type('Members');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${DEMO_URL}/w/demo/members`);
    await expect(page.locator('#main')).toBeFocused();

    const dialog = await open(page, '/w/demo/members');
    await page.keyboard.type(`Lab ${lab}`);
    await expect(group(dialog, 'Workspaces').getByRole('option')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${DEMO_URL}/w/${lab}/members`);
    await expect(page.locator('#main')).toBeFocused();
  });

  test('going back while it is open closes it, with the focus in the page\'s main content (review)', async ({ page }) => {
    // Within the app: a page loaded with goto would be reloaded by Back.
    const dialog = await open(page, '/w/demo/graph');
    await page.keyboard.type('Members');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${DEMO_URL}/w/demo/members`);
    await expect(page.locator('#main')).toBeFocused();
    // Until it has gone, the closing palette counts as another dialog, which keeps the shortcut.
    await expect(dialog).toHaveCount(0);
    await page.keyboard.press(SHORTCUT);
    await expect(dialog.getByRole('combobox', { name: 'Search' })).toBeFocused();

    await page.goBack();

    await expect(page).toHaveURL(`${DEMO_URL}/w/demo/graph`);
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#main')).toBeFocused();
  });

  test('the theme switch changes the theme and says so; Sign out signs out (7)', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: DEMO_URL, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await signInTo(page, DEMO_URL, USER);
    await open(page, '/settings');

    await page.keyboard.type('Theme');
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveClass(/\blight\b/);

    await open(page, '/settings');
    await page.keyboard.type('Sign out');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test('typing a hostname offers Trace <hostname>, which opens its trace (7)', async ({ page }) => {
    const dialog = await open(page, '/w/demo/graph');

    await page.keyboard.type('app.homelab.example');
    await expect(group(dialog, 'Actions').getByRole('option', { name: /^Trace app\.homelab\.example/ })).toBeVisible();
    await group(dialog, 'Actions').getByRole('option', { name: /^Trace app\.homelab\.example/ }).click();

    await expect(page).toHaveURL(`${DEMO_URL}/w/demo/trace?hostname=app.homelab.example`);
  });
});

test.describe('command palette, opening an entity', () => {
  const SELECTED = (type: string) => new RegExp(`[?&]selected=${type}(:|%3A)`);
  /** The id the search gives an entity of the demo workspace. */
  const idOf = async (page: Page, q: string) => {
    const { workspaces } = await (await page.request.get(`${DEMO_URL}/api/workspaces`)).json() as { workspaces: { id: string; slug: string }[] };
    const demo = workspaces.find(({ slug }) => slug === 'demo');
    const { items } = await (await page.request.get(`${DEMO_URL}/api/workspaces/${demo?.id ?? ''}/search`, { params: { q } }))
      .json() as { items: { id: string; title: string }[] };
    return items.find(({ title }) => title === q)?.id ?? '';
  };

  test('on Traffic, choosing a host selects it in the graph (?selected=host:<id>) and opens its panel, as a click does (9)', async ({ page }) => {
    const dialog = await open(page, '/w/demo/graph');
    await page.keyboard.type('Edge router');
    await expect(dialog.getByRole('group', { name: 'Entities' }).getByRole('option', { name: /^Edge router/ })).toBeVisible();

    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(SELECTED('host'));
    await expect(page.getByRole('complementary').getByRole('heading', { level: 2, name: 'Edge router' })).toBeVisible();
  });

  test('on Traffic, opening a link with ?selected= selects it; an id the graph does not draw selects nothing (9)', async ({ page }) => {
    const id = await idOf(page, 'Edge router');
    await page.goto(`/w/demo/graph?selected=host:${id}`);
    await hydrated(page);
    await expect(page.getByRole('complementary').getByRole('heading', { level: 2, name: 'Edge router' })).toBeVisible();

    await page.goto('/w/demo/graph?selected=host:0199d6a0-0000-7000-8000-999999999999');
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Traffic' })).toBeVisible();
    await expect(page.getByRole('complementary')).toHaveCount(0);
    await expect(page).not.toHaveURL(/selected=/);
  });

  test('on Trace, choosing an entity that is a hop of the trace selects its step (?selected=step:<id>) (10)', async ({ page }) => {
    const dialog = await open(page, '/w/demo/trace?hostname=app.homelab.example&client=public');
    await page.keyboard.type('app.homelab.example');
    // The proxy route: named by its hostnames.
    const route = dialog.getByRole('group', { name: 'Entities' }).getByRole('option', { name: /^homelab\.example, www\.homelab\.example, app\.homelab\.example/ });
    await expect(route).toBeVisible();

    await route.click();

    await expect(page).toHaveURL(SELECTED('step'));
    await expect(page).toHaveURL(/hostname=app\.homelab\.example/);
    await expect(page.getByRole('complementary')).toBeVisible();
  });

  test('elsewhere, choosing an entity opens its inventory page with its form; closing it removes ?open from the URL (11)', async ({ page }) => {
    const dialog = await open(page, '/w/demo/members');
    await page.keyboard.type('Edge router');
    await expect(dialog.getByRole('group', { name: 'Entities' }).getByRole('option', { name: /^Edge router/ })).toBeVisible();

    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/w\/demo\/inventory\/core\/host\?open=/);
    const form = page.getByRole('dialog', { name: 'Edit Edge router' });
    await expect(form.getByRole('textbox', { name: /^Name/ })).toHaveValue('Edge router');
    await page.keyboard.press('Escape');
    await expect(form).toBeHidden();
    await expect(page).not.toHaveURL(/open=/);
  });

  test('given a viewer, the entity\'s form opens read-only (11)', async ({ page, browser }) => {
    // A workspace of the test's own, where the user is a viewer: the demo's members stay as the other tests read them.
    const slug = `palette-${String(Date.now())}`;
    const created = await page.request.post(`${DEMO_URL}/api/workspaces`, { data: { name: `Palette ${slug}`, slug } });
    const { id: workspaceId } = await created.json() as { id: string };
    const host = await page.request.post(`${DEMO_URL}/api/workspaces/${workspaceId}/entities/core/host`, { data: { name: 'nas', kind: 'physical' } });
    const { id } = await host.json() as { id: string };
    const invitation = await page.request.post(`${DEMO_URL}/api/workspaces/${workspaceId}/invitations`, { data: { email: USER.email, role: 'viewer' } });
    const { url: link } = await invitation.json() as { url: string };
    const context = await browser.newContext({ baseURL: DEMO_URL, storageState: { cookies: [], origins: [] } });
    const viewer = await context.newPage();
    await signInTo(viewer, DEMO_URL, USER);
    expect(await acceptInvitation(viewer, link)).toBe(200);

    await viewer.goto(`/w/${slug}/inventory/core/host?open=${id}`);
    await hydrated(viewer);

    const form = viewer.getByRole('dialog', { name: 'nas' });
    await expect(form.getByRole('textbox', { name: /^Name/ })).toHaveAttribute('readonly');
    await context.close();
  });

  test('given ?open= with an id the page does not have, the table\'s live region says it was not found (11)', async ({ page }) => {
    await page.goto('/w/demo/inventory/core/host?open=0199d6a0-0000-7000-8000-999999999999');
    await hydrated(page);

    await expect(page.getByRole('status').filter({ hasText: 'This entity was not found.' })).toHaveCount(1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).not.toHaveURL(/open=/);
  });

  test('New <type> opens its inventory page with the create form; closing it removes ?new from the URL (12)', async ({ page }) => {
    await open(page, '/w/demo/graph');
    await page.keyboard.type('New Host');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/w\/demo\/inventory\/core\/host\?new=1/);
    const form = page.getByRole('dialog', { name: 'New Host' });
    await expect(form.getByRole('textbox', { name: /^Name/ })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(form).toBeHidden();
    await expect(page).not.toHaveURL(/new=1/);
  });
});
