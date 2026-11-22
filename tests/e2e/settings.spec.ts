import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { DEMO_URL, OWN_PASSWORD, ownAccount, signInTo } from './support/accounts';
import { hydrated } from './support/hydration';

import type { Page } from '@playwright/test';

const expectNoAxeViolation = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`))
    .toEqual([]);
};

const TEMPORARY = 'temporary horse battery';
const OWN = OWN_PASSWORD;

test.describe('settings', () => {
  test('preferences saved on the account apply on the next load, during server rendering (3)', async ({ page, browser }) => {
    const { page: own, context } = await ownAccount(page, browser);
    await own.request.put(`${DEMO_URL}/api/account/preferences`, { data: { theme: 'light', contrast: 'strict', locale: 'fr' } });

    // No JavaScript: what the server renders.
    const response = await own.request.get(`${DEMO_URL}/settings`);
    const html = await response.text();

    expect(html).toMatch(/<html[^>]*lang="fr/);
    expect(html).toMatch(/<html[^>]*data-contrast="strict"/);
    // Color mode sets the theme's class from its cookie, in a script that runs before the first paint.
    expect(response.headers()['set-cookie']).toMatch(/nuxt-color-mode=light/);
    await context.close();
  });

  test('a switch changed while signed in applies at once and is saved to the account (4)', async ({ page, browser }) => {
    const { page: own, context } = await ownAccount(page, browser);
    await own.goto('/settings');
    await hydrated(own);

    await own.getByRole('main').getByRole('radio', { name: 'Light' }).check();

    await expect(own.locator('html')).toHaveClass(/light/);
    await expect(own.getByRole('region', { name: 'Display and landing page' })).toContainText('Saved');
    const session = await (await own.request.get(`${DEMO_URL}/api/session`)).json() as { user: { preferences: { theme: string } } };
    expect(session.user.preferences.theme).toBe('light');
    await context.close();
  });

  test('preferences saved in one browser apply after signing in from another (5)', async ({ page, browser }) => {
    const { page: own, context, email } = await ownAccount(page, browser);
    await own.request.put(`${DEMO_URL}/api/account/preferences`, { data: { locale: 'fr' } });
    await context.close();

    const other = await browser.newContext({ baseURL: DEMO_URL, storageState: { cookies: [], origins: [] } });
    const elsewhere = await other.newPage();
    await elsewhere.goto('/login');
    await hydrated(elsewhere);
    await elsewhere.getByRole('textbox', { name: 'Email' }).fill(email);
    await elsewhere.getByLabel('Password', { exact: true }).fill(OWN);
    await elsewhere.getByRole('button', { name: 'Sign in' }).click();

    await expect(elsewhere.locator('html')).toHaveAttribute('lang', /^fr/);
    await other.close();
  });

  test('/ opens the landing page chosen in the settings (6)', async ({ page, browser }) => {
    const { page: own, context } = await ownAccount(page, browser);
    await own.goto('/settings');
    await hydrated(own);

    await own.getByRole('radio', { name: 'Trace' }).check();
    await expect(own.getByRole('region', { name: 'Display and landing page' })).toContainText('Saved');
    await own.goto('/');

    await expect(own).toHaveURL(/\/trace/);
    await context.close();
  });

  test('the password changes on /settings, the change is announced and other sessions are signed out (7, 10)', async ({ page, browser }) => {
    const { page: own, context, email } = await ownAccount(page, browser);
    const other = await browser.newContext({ baseURL: DEMO_URL, storageState: { cookies: [], origins: [] } });
    const otherPage = await other.newPage();
    await signInTo(otherPage, DEMO_URL, { email, password: OWN });
    await own.goto('/settings');
    await hydrated(own);

    await own.getByLabel(/^Current password/).fill(OWN);
    await own.getByLabel(/^New password/).fill('an even newer horse battery');
    await own.getByLabel(/^Confirm the new password/).fill('an even newer horse battery');
    await own.getByRole('button', { name: 'Change the password' }).click();

    await expect(own.getByRole('region', { name: 'Password' }).getByRole('status')).toContainText('Password changed');
    expect(await (await otherPage.request.get(`${DEMO_URL}/api/session`)).json()).toBeNull();
    expect(await (await own.request.get(`${DEMO_URL}/api/session`)).json()).not.toBeNull();
    await other.close();
    await context.close();
  });

  test('an account given a temporary password is sent to /settings/password, then to its landing page once changed (13)', async ({ page, browser }) => {
    const { page: own, context, email } = await ownAccount(page, browser);
    const users = await (await page.request.get(`${DEMO_URL}/api/users`)).json() as { users: { id: string; email: string }[] };
    const id = users.users.find((user) => user.email === email)?.id ?? '';
    expect((await page.request.put(`${DEMO_URL}/api/users/${id}/password`, { data: { password: TEMPORARY } })).status()).toBe(204);
    await signInTo(own, DEMO_URL, { email, password: TEMPORARY });

    await own.goto('/w/demo/graph');
    await expect(own).toHaveURL(`${DEMO_URL}/settings/password`);
    await hydrated(own);
    await expect(own.getByRole('heading', { level: 1 })).toHaveText('Choose your own password');
    await expect(own.getByRole('heading', { level: 1 })).toBeFocused();
    await own.getByLabel(/^Current password/).fill(TEMPORARY);
    await own.getByLabel(/^New password/).fill(OWN);
    await own.getByLabel(/^Confirm the new password/).fill(OWN);
    await own.getByRole('button', { name: 'Change the password' }).click();

    await expect(own).toHaveURL(new RegExp(`^${DEMO_URL}/graph`));
    await context.close();
  });

  test('Settings has a Command palette section, every group checked; one unchecked is saved, and the palette neither lists nor searches it (13)', async ({ page, browser }) => {
    const { page: own, context } = await ownAccount(page, browser);
    await own.goto('/settings');
    await hydrated(own);
    const section = own.getByRole('group', { name: 'Search' });
    for (const name of ['Entities', 'Pages', 'Workspaces', 'Actions']) {
      await expect(section.getByRole('checkbox', { name })).toBeChecked();
    }

    const saved = own.waitForResponse((response) => response.url().endsWith('/api/account/preferences') && response.ok());
    await section.getByRole('checkbox', { name: 'Entities' }).click();
    await saved;
    await own.reload();
    await hydrated(own);
    await expect(own.getByRole('group', { name: 'Search' }).getByRole('checkbox', { name: 'Entities' })).not.toBeChecked();

    const searches: string[] = [];
    own.on('request', (request) => {
      if (request.url().includes('/search?')) {
        searches.push(request.url());
      }
    });
    await own.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
    const dialog = own.getByRole('dialog', { name: 'Search' });
    await expect(dialog.getByRole('combobox', { name: 'Search' })).toBeFocused();
    await own.keyboard.type('Settings');
    await expect(dialog.getByRole('group', { name: 'Pages' })).toBeVisible();
    await expect(dialog.getByRole('group', { name: 'Entities' })).toHaveCount(0);
    expect(searches).toEqual([]);
    await context.close();
  });

  test('the Search settings sit in a section named for them; a failed save is shown after them and puts the checkbox back (review)', async ({ page, browser }) => {
    const { page: own, context } = await ownAccount(page, browser);
    await own.goto('/settings');
    await hydrated(own);
    const section = own.getByRole('region', { name: 'Display, landing page and search' });
    const search = section.getByRole('group', { name: 'Search' });
    await expect(search).toBeVisible();

    await own.route('**/api/account/preferences', (route) => route.fulfill({ status: 500 }));
    await search.getByRole('checkbox', { name: 'Pages' }).click();

    const error = section.getByText('Your preferences could not be saved. Try again.');
    await expect(error).toBeVisible();
    // After the checkboxes, where the eye is: the fieldset comes before it.
    const follows = await search.evaluate(
      (fieldset, message) => (fieldset.compareDocumentPosition(message as Node) & Node.DOCUMENT_POSITION_FOLLOWING) > 0,
      await error.elementHandle(),
    );
    expect(follows).toBe(true);
    await expect(search.getByRole('checkbox', { name: 'Pages' })).toBeChecked();
    await context.close();
  });

  test('quick changes are saved in order: the last one wins (review)', async ({ page, browser }) => {
    const { page: own, context } = await ownAccount(page, browser);
    await own.goto('/settings');
    await hydrated(own);
    const search = own.getByRole('group', { name: 'Search' });
    // The first save is slow on its way: sent alone, the second would reach the server first.
    let first = true;
    await own.route('**/api/account/preferences', async (route) => {
      if (first) {
        first = false;
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      await route.continue();
    });

    await search.getByRole('checkbox', { name: 'Entities' }).click();
    await search.getByRole('checkbox', { name: 'Pages' }).click();
    await expect.poll(async () => {
      const session = await (await own.request.get(`${DEMO_URL}/api/session`)).json() as { user: { preferences: { palette: { hidden: string[] } } } };
      return session.user.preferences.palette.hidden;
    }, { timeout: 5000 }).toEqual(['group:entities', 'group:pages']);
    await context.close();
  });

  test('a checkbox focused with the keyboard shows a solid outline (review)', async ({ page, browser }) => {
    const { page: own, context } = await ownAccount(page, browser);
    await own.goto('/settings');
    await hydrated(own);
    const entities = own.getByRole('group', { name: 'Search' }).getByRole('checkbox', { name: 'Entities' });
    // From the landing page's radios, with the keyboard: focus-visible applies.
    await own.getByRole('radio', { name: 'Trace' }).focus();
    const focused = () => entities.evaluate((box) => box === document.activeElement);
    for (let presses = 0; presses < 20 && !await focused(); presses += 1) {
      await own.keyboard.press('Tab');
    }
    await expect(entities).toBeFocused();

    const outline = await entities.evaluate((box) => getComputedStyle(box).outlineColor);
    // Fully opaque: Nuxt UI's is a quarter of the primary color, below 3:1.
    expect(outline).not.toMatch(/\/\s*0?\.\d+\)|,\s*0?\.\d+\)$/);
    await context.close();
  });

  test('/settings and /settings/password have no axe violation', async ({ page, browser }) => {
    await page.goto('/settings');
    await hydrated(page);
    await expect(page).toHaveTitle(/^Settings/);
    await expectNoAxeViolation(page);

    const { page: own, context, email } = await ownAccount(page, browser);
    const users = await (await page.request.get(`${DEMO_URL}/api/users`)).json() as { users: { id: string; email: string }[] };
    const id = users.users.find((user) => user.email === email)?.id ?? '';
    await page.request.put(`${DEMO_URL}/api/users/${id}/password`, { data: { password: TEMPORARY } });
    await signInTo(own, DEMO_URL, { email, password: TEMPORARY });
    await own.goto('/settings/password');
    await hydrated(own);
    await expectNoAxeViolation(own);
    await context.close();
  });
});
