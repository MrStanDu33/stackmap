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

  /**
   * Records, from now on, each text a live region takes that holds the words, and whether the page was then hidden from
   * screen readers (a modal dialog hides the rest of the page): what is said there is not heard.
   */
  const recordStatus = (page: Page, text: string) => page.evaluate((wanted) => {
    const seen: { text: string; hidden: boolean }[] = [];
    (window as unknown as { seen: typeof seen }).seen = seen;
    new MutationObserver((mutations) => {
      for (const { target } of mutations) {
        const region = (target instanceof Element ? target : target.parentElement)?.closest('[role="status"]');
        if (region?.textContent.includes(wanted)) {
          seen.push({ text: region.textContent.trim(), hidden: region.closest('[aria-hidden="true"]') !== null });
        }
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  }, text);
  type Said = { text: string; hidden: boolean }[];
  const recorded = (page: Page) => page.evaluate(() => (window as unknown as { seen: Said }).seen);

  test('on Traffic, choosing a host selects it in the graph (?selected=host:<id>) and opens its panel, as a click does, announced once the palette has closed; Escape gives the focus back to the Search button (9, review)', async ({ page }) => {
    await page.goto('/w/demo/graph');
    await hydrated(page);
    const search = page.getByRole('button', { name: 'Search', exact: true });
    await search.click();
    const dialog = page.getByRole('dialog', { name: 'Search' });
    await page.keyboard.type('Edge router');
    await expect(dialog.getByRole('group', { name: 'Entities' }).getByRole('option', { name: /^Edge router/ })).toBeVisible();

    await recordStatus(page, 'Selected: Edge router');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(SELECTED('host'));
    await expect(page.getByRole('complementary').getByRole('heading', { level: 2, name: 'Edge router' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Selected: Edge router' })).toHaveCount(1);
    // Said once the palette had gone: the page was no longer hidden from screen readers.
    expect(await recorded(page)).toEqual([{ text: 'Selected: Edge router', hidden: false }]);
    await expect(search).toBeFocused();

    // Chosen again: said again.
    await recordStatus(page, 'Selected: Edge router');
    await search.click();
    await page.keyboard.type('Edge router');
    await expect(dialog.getByRole('group', { name: 'Entities' }).getByRole('option', { name: /^Edge router/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect.poll(() => recorded(page)).toEqual([{ text: 'Selected: Edge router', hidden: false }]);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('complementary')).toHaveCount(0);
    await expect(search).toBeFocused();
  });

  test('on Traffic, opening a link with ?selected= selects it; an id the graph does not draw selects nothing (9)', async ({ page }) => {
    const id = await idOf(page, 'Edge router');
    await page.goto(`/w/demo/graph?selected=host:${id}`);
    await hydrated(page);
    await expect(page.getByRole('complementary').getByRole('heading', { level: 2, name: 'Edge router' })).toBeVisible();
    // The traffic's summary is said with it, not replaced (review).
    await expect(page.getByRole('status').filter({ hasText: '2 hosts' }).filter({ hasText: 'Selected: Edge router' })).toHaveCount(1);

    await page.goto('/w/demo/graph?selected=host:0199d6a0-0000-7000-8000-999999999999');
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Traffic' })).toBeVisible();
    await expect(page.getByRole('complementary')).toHaveCount(0);
    await expect(page).not.toHaveURL(/selected=/);
  });

  test('on Trace, choosing an entity that is a hop of the trace selects its step (?selected=step:<id>), naming the entity chosen (10, review)', async ({ page }) => {
    const dialog = await open(page, '/w/demo/trace?hostname=app.homelab.example&client=public');
    await page.keyboard.type('app.homelab.example');
    // The proxy route: named by its hostnames.
    const route = dialog.getByRole('group', { name: 'Entities' }).getByRole('option', { name: /^homelab\.example, www\.homelab\.example, app\.homelab\.example/ });
    await expect(route).toBeVisible();

    await route.click();

    await expect(page).toHaveURL(SELECTED('step'));
    await expect(page).toHaveURL(/hostname=app\.homelab\.example/);
    await expect(page.getByRole('complementary')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Chosen: homelab.example, www.homelab.example, app.homelab.example.' })
      .filter({ hasText: /Step \d of \d/ })).toHaveCount(1);
  });

  test('elsewhere, choosing an entity opens its inventory page with its form; closing it removes ?open from the URL and focuses its row (11, review)', async ({ page }) => {
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
    await expect(page.getByRole('button', { name: 'Edit Edge router' })).toBeFocused();

    // From a link too, where nothing had the focus.
    const id = await idOf(page, 'Edge router');
    await page.goto(`/w/demo/inventory/core/host?open=${id}`);
    await hydrated(page);
    await expect(form).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Edit Edge router' })).toBeFocused();
  });

  test('given a viewer, the entity\'s form opens read-only, and ?new=1 says only editors can add (11, 12, review)', async ({ page, browser }) => {
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

    await viewer.goto(`/w/${slug}/inventory/core/host?new=1`);
    await hydrated(viewer);
    await expect(viewer.getByText('Only editors can add entities here.')).toBeVisible();
    await expect(viewer.getByRole('dialog')).toHaveCount(0);
    await context.close();
  });

  test('given ?open= with an id the page does not have, or no id at all, it says so in view and to screen readers, fetching nothing else (11, review)', async ({ page }) => {
    for (const open of ['0199d6a0-0000-7000-8000-999999999999', '.', '..', 'not-an-id']) {
      const requests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/entities/core/host/')) {
          requests.push(request.url());
        }
      });
      await page.goto(`/w/demo/inventory/core/host?open=${open}`);
      await hydrated(page);

      const notice = page.getByRole('status').filter({ hasText: 'This entity was not found.' });
      await expect(notice, open).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page).not.toHaveURL(/open=/);
      // Only the list: an id that is not one never reaches another endpoint.
      expect(requests, open).toEqual(open.startsWith('0199') ? [expect.stringContaining(open)] : []);
      page.removeAllListeners('request');
    }
  });

  test('given ?open= that cannot be fetched, it says it could not be opened rather than not found (11, review)', async ({ page }) => {
    const id = await idOf(page, 'Edge router');
    await page.route(`**/entities/core/host/${id}`, (route) => route.fulfill({ status: 500 }));
    await page.goto(`/w/demo/inventory/core/host?open=${id}`);
    await hydrated(page);

    await expect(page.getByText('This entity could not be opened. Check your connection and try again.')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
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
    await expect(page.getByRole('button', { name: 'New Host' })).toBeFocused();
  });
});
