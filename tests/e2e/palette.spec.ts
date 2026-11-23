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

test.describe('command palette filters', () => {
  const group = (dialog: ReturnType<Page['getByRole']>, name: string) => dialog.getByRole('group', { name });
  /** Opens the palette on Traffic and turns "host" into a chip. */
  const withHostChip = async (page: Page) => {
    const dialog = await open(page, '/w/demo/graph');
    await page.keyboard.type('host');
    await dialog.getByRole('option', { name: /^Filter by Host/ }).click();
    return dialog;
  };

  test('typing "host" offers Search “host” then Filter by Host; choosing the filter shows a Host chip, empties the field and keeps the focus there (14, 15)', async ({ page }) => {
    const dialog = await open(page, '/w/demo/graph');
    await page.keyboard.type('host');

    const options = group(dialog, 'Filters').getByRole('option');
    await expect(options).toHaveText([/^Search “host”/, /^Filter by Host/]);
    await expect(dialog.getByRole('option').first()).toHaveText(/^Search “host”/);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    const field = dialog.getByRole('combobox', { name: 'Search' });
    await expect(dialog.getByText('Host', { exact: true })).toBeVisible();
    await expect(field).toHaveValue('');
    await expect(field).toBeFocused();
    await expect(field).toHaveAccessibleDescription('Filter: Host');
  });

  test('with a Host chip, typing searches only hosts (entity=host), and lists no pages, workspaces or actions (16)', async ({ page }) => {
    const dialog = await withHostChip(page);
    const searched = page.waitForRequest((request) => request.url().includes('/search?'));
    await page.keyboard.type('203.0.113.10');

    const url = new URL((await searched).url());
    expect(url.searchParams.get('extension')).toBe('core');
    expect(url.searchParams.get('entity')).toBe('host');
    await expect(group(dialog, 'Entities').getByRole('option', { name: /^Edge router/ })).toBeVisible();
    await expect(group(dialog, 'Entities').getByRole('option')).toHaveCount(1);
    for (const name of ['Pages', 'Workspaces', 'Actions']) {
      await expect(group(dialog, name)).toHaveCount(0);
    }
  });

  test('with a Pages chip, only pages are listed and no entity is searched (16)', async ({ page }) => {
    const dialog = await open(page, '/w/demo/graph');
    await page.keyboard.type('pages');
    await dialog.getByRole('option', { name: /^Filter by Page/ }).click();
    // Counted from the chip on: the word typed before it was searched as any word is.
    const searches: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/search?')) {
        searches.push(request.url());
      }
    });
    await page.keyboard.type('trace');

    await expect(group(dialog, 'Pages').getByRole('option', { name: /^Trace/ })).toBeVisible();
    await expect(dialog.getByRole('group')).toHaveCount(1);
    expect(searches).toEqual([]);
  });

  test('Backspace in the empty field removes the chip and gives its word back; the chip\'s remove button does too, the focus in the field (15)', async ({ page }) => {
    const dialog = await withHostChip(page);
    const field = dialog.getByRole('combobox', { name: 'Search' });

    await page.keyboard.press('Backspace');
    await expect(dialog.getByRole('button', { name: 'Remove the Host filter' })).toHaveCount(0);
    await expect(field).toHaveValue('host');

    await dialog.getByRole('option', { name: /^Filter by Host/ }).click();
    await dialog.getByRole('button', { name: 'Remove the Host filter' }).click();
    await expect(dialog.getByRole('button', { name: 'Remove the Host filter' })).toHaveCount(0);
    await expect(field).toHaveValue('host');
    await expect(field).toBeFocused();
  });

  test('with nothing typed, the Filters group comes first; choosing Filter by Page shows its chip, the focus in the field (19)', async ({ page }) => {
    const dialog = await open(page, '/w/demo/graph');

    await expect(dialog.getByRole('group').first()).toHaveAccessibleName('Filters');
    await expect(dialog.getByRole('option').first()).toHaveText(/^Filter by Entity/);
    await group(dialog, 'Filters').getByRole('option', { name: /^Filter by Page/ }).click();

    const field = dialog.getByRole('combobox', { name: 'Search' });
    await expect(field).toHaveAccessibleDescription('Filter: Page');
    await expect(field).toBeFocused();
    await expect(group(dialog, 'Filters')).toHaveCount(0);
  });

  test('Extension filters… lists the extensions\' and types\' filters, the focus in the field; Back to all filters goes back; closing goes back too (20)', async ({ page }) => {
    const dialog = await open(page, '/w/demo/graph');
    const field = dialog.getByRole('combobox', { name: 'Search' });
    await expect(group(dialog, 'Filters').getByRole('option', { name: /^Filter by Host/ })).toHaveCount(0);

    await group(dialog, 'Filters').getByRole('option', { name: /^Extension filters…/ }).click();
    await expect(field).toBeFocused();
    await expect(dialog.getByRole('group')).toHaveCount(1);
    await expect(dialog.getByRole('option').first()).toHaveText(/^Back to all filters/);
    await expect(group(dialog, 'Extension filters').getByRole('option', { name: /^Filter by Host/ })).toBeVisible();

    await group(dialog, 'Extension filters').getByRole('option', { name: /^Back to all filters/ }).click();
    await expect(group(dialog, 'Filters').getByRole('option', { name: /^Extension filters…/ })).toBeVisible();
    await expect(group(dialog, 'Pages')).toBeVisible();

    await group(dialog, 'Filters').getByRole('option', { name: /^Extension filters…/ }).click();
    await page.keyboard.press('Escape');
    await page.keyboard.press(SHORTCUT);
    await expect(group(dialog, 'Filters').getByRole('option', { name: /^Extension filters…/ })).toBeVisible();
  });

  test('typing "port" offers Filter by Port forward, then the less exact Proxy route, before the results; choosing one shows its chip (14)', async ({ page }) => {
    const dialog = await open(page, '/w/demo/graph');
    await page.keyboard.type('port');

    await expect(group(dialog, 'Filters').getByRole('option'))
      .toHaveText([/^Search “port”/, /^Filter by Port forward/, /^Filter by Proxy route/]);
    await expect(dialog.getByRole('group').first()).toHaveAccessibleName('Filters');
    await group(dialog, 'Filters').getByRole('option', { name: /^Filter by Port forward/ }).click();

    await expect(dialog.getByRole('combobox', { name: 'Search' })).toHaveAccessibleDescription('Filter: Port forward');
  });

  /** The characters an option shows bold, in order. */
  const bold = (option: ReturnType<Page['getByRole']>) => option.evaluate((element) => [...element.querySelectorAll('[data-match]')]
    .filter((match) => Number(getComputedStyle(match).fontWeight) >= 600)
    .map(({ textContent }) => textContent).join(''));

  test('typing "ofw" shows Filter by Port forward with o, f and w bold (22)', async ({ page }) => {
    const dialog = await open(page, '/w/demo/graph');
    await page.keyboard.type('ofw');

    const option = group(dialog, 'Filters').getByRole('option', { name: /^Filter by Port forward/ });
    await expect(option).toBeVisible();
    expect(await bold(option)).toBe('ofw');
  });

  test('typing "sgo" lists the Sign out action with S, g and o bold (21, 22)', async ({ page }) => {
    const dialog = await open(page, '/w/demo/graph');
    await page.keyboard.type('sgo');

    const option = group(dialog, 'Actions').getByRole('option', { name: /^Sign out/ });
    await expect(option).toBeVisible();
    expect(await bold(option)).toBe('Sgo');
  });

  test('typing "edgrt" finds Edge router among the entities, with E, d, g, r and t bold (21, 22)', async ({ page }) => {
    const dialog = await open(page, '/w/demo/graph');
    await page.keyboard.type('edgrt');

    const option = group(dialog, 'Entities').getByRole('option', { name: /^Edge router/ });
    await expect(option).toBeVisible();
    expect(await bold(option)).toBe('Edgrt');
  });

  test('the palette with a chip has no axe violation (15)', async ({ page }) => {
    await withHostChip(page);
    await page.keyboard.type('edge');

    await expectNoAxeViolation(page);
  });
});
