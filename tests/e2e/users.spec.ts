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

const unique = (name: string) => `${name}-${String(Date.now())}-${String(Math.floor(Math.random() * 1000))}`;
const PASSWORD = 'temporary horse battery';

/** An account of the test's own on the demo server, made as the administrator: its id, name and email. */
const createUser = async (page: Page) => {
  const name = unique('Linus');
  const email = `${name.toLowerCase()}@homelab.example`;
  const response = await page.request.post(`${DEMO_URL}/api/users`, { data: { name, email, password: PASSWORD } });
  expect(response.status()).toBe(201);
  return { ...(await response.json() as { id: string }), name, email };
};

test.describe('users page', () => {
  test('the administrator creates an account, which then signs in and is told to ask for an invitation (2, 17)', async ({ page, browser }) => {
    const name = unique('Ken');
    const email = `${name.toLowerCase()}@homelab.example`;
    await page.goto('/admin/users');
    await hydrated(page);
    await expect(page).toHaveTitle(/^Users/);

    await page.getByRole('textbox', { name: /^Name/ }).fill(name);
    await page.getByRole('textbox', { name: /^Email/ }).fill(email);
    await page.getByLabel(/^Temporary password/).fill(PASSWORD);
    await page.getByRole('button', { name: 'Create the account' }).click();

    await expect(page.getByRole('status')).toContainText(`Send the password to ${email}`);
    await expect(page.getByRole('table', { name: 'Accounts' }).getByRole('row', { name: new RegExp(`^${name}`) })).toBeVisible();

    const context = await browser.newContext({ baseURL: DEMO_URL, storageState: { cookies: [], origins: [] } });
    const newcomer = await context.newPage();
    await signInTo(newcomer, DEMO_URL, { email, password: PASSWORD });
    await newcomer.goto('/graph');
    await expect(newcomer.getByText('Ask an administrator', { exact: false })).toBeVisible();
    await context.close();
  });

  test('the administrator promotes, gives a new temporary password to, and removes an account (8, 18, 19)', async ({ page }) => {
    const user = await createUser(page);
    await page.goto('/admin/users');
    await hydrated(page);
    const row = page.getByRole('row', { name: new RegExp(`^${user.name}`) });

    await row.getByRole('combobox', { name: `Instance role of ${user.name}` }).click();
    await page.getByRole('option', { name: 'Administrator' }).click();
    await expect(row.getByRole('combobox', { name: `Instance role of ${user.name}` })).toHaveText('Administrator');

    await row.getByRole('button', { name: `New temporary password for ${user.name}` }).click();
    const dialog = page.getByRole('dialog', { name: `New temporary password for ${user.name}` });
    await dialog.getByLabel(/^Temporary password/).fill('brand new horse battery');
    await dialog.getByRole('button', { name: 'Set the password' }).click();
    await expect(dialog.getByRole('status')).toContainText('signed out everywhere');
    await page.keyboard.press('Escape');

    await row.getByRole('button', { name: `Remove ${user.name}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: `Remove ${user.name}` }).click();
    await expect(row).toHaveCount(0);
  });

  test('removing the only owner of a workspace is refused and names the workspace (14, 20)', async ({ page, browser }) => {
    const user = await createUser(page);
    const slug = unique('solo');
    const workspace = await page.request.post(`${DEMO_URL}/api/workspaces`, { data: { name: `Solo ${slug}`, slug } });
    expect(workspace.status()).toBe(201);
    const { id: workspaceId } = await workspace.json() as { id: string };
    // The user becomes owner, and the administrator who created it leaves: the user is its only owner.
    const invitation = await page.request.post(`${DEMO_URL}/api/workspaces/${workspaceId}/invitations`, {
      data: { email: user.email, role: 'owner' },
    });
    const token = (await invitation.json() as { url: string }).url.split('/').pop() ?? '';
    const owner = await browser.newContext({ baseURL: DEMO_URL, storageState: { cookies: [], origins: [] } });
    const ownerPage = await owner.newPage();
    await signInTo(ownerPage, DEMO_URL, { email: user.email, password: PASSWORD });
    expect((await ownerPage.request.post(`${DEMO_URL}/api/invitations/${token}/accept`)).status()).toBe(200);
    await owner.close();
    const me = await (await page.request.get(`${DEMO_URL}/api/session`)).json() as { user: { id: string } };
    expect((await page.request.delete(`${DEMO_URL}/api/workspaces/${workspaceId}/members/${me.user.id}`)).status()).toBe(204);

    await page.goto('/admin/users');
    await hydrated(page);
    await page.getByRole('row', { name: new RegExp(`^${user.name}`) }).getByRole('button', { name: `Remove ${user.name}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: `Remove ${user.name}` }).click();

    await expect(page.getByRole('alert')).toContainText(`Solo ${slug}`);
    await expect(page.getByRole('row', { name: new RegExp(`^${user.name}`) })).toBeVisible();
  });

  test('the sidebar shows Users to the administrator, who sees no actions on their own row (17, 21)', async ({ page }) => {
    await page.goto('/graph');
    await hydrated(page);
    await page.getByRole('navigation').getByRole('link', { name: 'Users' }).click();

    await expect(page).toHaveURL(`${DEMO_URL}/admin/users`);
    const own = page.getByRole('row', { name: /^Ada/ });
    await expect(own).toContainText('You');
    await expect(own.getByRole('button')).toHaveCount(0);
    await expectNoAxeViolation(page);
  });

  test('a plain user has no Users link, and on /admin/users is told the page is for administrators (21)', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: DEMO_URL, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await signInTo(page, DEMO_URL, USER);

    await page.goto('/graph');
    await hydrated(page);
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Users' })).toHaveCount(0);
    await page.goto('/admin/users');
    await hydrated(page);
    await expect(page.getByText('This page is for administrators.')).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
    await expectNoAxeViolation(page);
    await context.close();
  });
});
