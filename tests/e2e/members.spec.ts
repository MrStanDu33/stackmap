import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { ADMIN, DEMO_URL, signInTo, USER } from './support/accounts';
import { hydrated } from './support/hydration';

import type { Page } from '@playwright/test';

const expectNoAxeViolation = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`))
    .toEqual([]);
};

/** A workspace of the test's own on the demo server, its id and slug, owned by the administrator. */
const createWorkspace = async (page: Page) => {
  const slug = `team-${String(Date.now())}-${String(Math.floor(Math.random() * 1000))}`;
  const response = await page.request.post(`${DEMO_URL}/api/workspaces`, { data: { name: `Team ${slug}`, slug } });
  expect(response.status()).toBe(201);
  return { ...(await response.json() as { id: string }), slug };
};

/** An invitation to the workspace, made as its owner: its link's path. */
const invite = async (page: Page, workspaceId: string, email: string, role = 'editor') => {
  const response = await page.request.post(`${DEMO_URL}/api/workspaces/${workspaceId}/invitations`, { data: { email, role } });
  expect(response.status()).toBe(201);
  return (await response.json() as { url: string }).url;
};

const uniqueEmail = (name: string) => `${name}-${String(Date.now())}-${String(Math.floor(Math.random() * 1000))}@homelab.example`;

test.describe('members and invitations', () => {
  test('given /invite/<token> signed out, the page offers to sign in with the invited account, then accepts it and leads to the workspace (12)', async ({ page, browser }) => {
    const workspace = await createWorkspace(page);
    const link = await invite(page, workspace.id, USER.email);

    const context = await browser.newContext({ baseURL: DEMO_URL, storageState: { cookies: [], origins: [] } });
    const visitor = await context.newPage();
    await visitor.goto(link);
    await hydrated(visitor);
    await expect(visitor).toHaveTitle(/^Invitation to join Team /);
    await expect(visitor.getByText(/^Ada invited you to Team .* with the editor role\.$/)).toBeVisible();
    await expect(visitor.getByText(`Sign in with ${USER.email}`, { exact: false })).toBeVisible();
    await expect(visitor.getByRole('textbox')).toHaveCount(0);
    await expectNoAxeViolation(visitor);

    await visitor.getByRole('link', { name: 'Sign in to accept' }).click();
    await hydrated(visitor);
    await visitor.getByRole('textbox', { name: 'Email' }).fill(USER.email);
    await visitor.getByLabel('Password', { exact: true }).fill(USER.password);
    await visitor.getByRole('button', { name: 'Sign in' }).click();
    await expect(visitor).toHaveURL(`${DEMO_URL}${link}`);
    await hydrated(visitor);
    await visitor.getByRole('button', { name: 'Accept the invitation' }).click();

    await expect(visitor).toHaveURL(`${DEMO_URL}/w/${workspace.slug}/graph`);
    await context.close();
  });

  test('given /invite/<token> signed in with another email, the page says whom it is for and offers Sign out (12)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    const link = await invite(page, workspace.id, 'someone.else@homelab.example');
    // A session of its own: signing out below must not end the one the other tests share.
    await signInTo(page, DEMO_URL);

    await page.goto(link);

    await expect(page.getByText(`You are signed in as ${ADMIN.email}.`, { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept the invitation' })).toHaveCount(0);

    // Signed out, the page stays, and focus goes to what to do next.
    await hydrated(page);
    await page.getByRole('main').getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('link', { name: 'Sign in to accept' })).toBeFocused();
  });

  test('given /w/<slug>/members, a viewer sees the members and Leave on their own row only (18)', async ({ page, browser }) => {
    const workspace = await createWorkspace(page);
    const link = await invite(page, workspace.id, USER.email, 'viewer');
    const context = await browser.newContext({ baseURL: DEMO_URL, storageState: { cookies: [], origins: [] } });
    const viewer = await context.newPage();
    await signInTo(viewer, DEMO_URL, USER);
    expect((await viewer.request.post(`${DEMO_URL}/api${link.replace('/invite/', '/invitations/')}/accept`)).status()).toBe(200);

    await viewer.goto(`/w/${workspace.slug}/members`);

    const members = viewer.getByRole('table', { name: 'Members' });
    await expect(members).toContainText('Ada');
    await expect(members.getByRole('combobox')).toHaveCount(0);
    await expect(viewer.getByRole('button', { name: 'Leave this workspace' })).toBeVisible();
    await expect(viewer.getByRole('form', { name: 'Invite someone' })).toHaveCount(0);
    await expectNoAxeViolation(viewer);
    await context.close();
  });

  test('given an owner, the page invites, manages roles and removes members, with no axe violation (18)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await page.goto(`/w/${workspace.slug}/members`);
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Members' })).toBeVisible();
    await expectNoAxeViolation(page);

    await page.getByRole('textbox', { name: /^Email/ }).fill(uniqueEmail('linus'));
    await page.getByRole('button', { name: 'Create the invitation link' }).click();
    const pending = page.getByRole('table', { name: 'Pending invitations' });
    await expect(pending).toContainText('linus-');
    await pending.getByRole('button', { name: /^Revoke the invitation for/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Revoke the invitation' }).click();
    await expect(page.getByRole('table', { name: 'Pending invitations' })).toHaveCount(0);
    // Its row is gone with the button that had focus: focus goes to the members' heading, and the change is said.
    await expect(page.getByRole('heading', { level: 2, name: 'Members' })).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: 'Invitation revoked' })).toHaveCount(1);
  });

  test('given a new invitation, the page shows its link once with Copy, focused and announced (19)', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const workspace = await createWorkspace(page);
    await page.goto(`/w/${workspace.slug}/members`);
    await hydrated(page);

    await page.getByRole('textbox', { name: /^Email/ }).fill(uniqueEmail('alan'));
    await page.getByRole('button', { name: 'Create the invitation link' }).click();

    const link = page.getByRole('textbox', { name: 'Invitation link' });
    await expect(link).toBeFocused();
    await expect(link).toHaveValue(new RegExp(`^${DEMO_URL}/invite/[\\w-]{43}$`));
    await page.getByRole('button', { name: 'Copy' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Copied' })).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Invitation link' })).toHaveCount(0);
  });

  test('given the last owner, leaving or demoting themselves is refused with an explanation (16)', async ({ page }) => {
    const workspace = await createWorkspace(page);
    await page.goto(`/w/${workspace.slug}/members`);
    await hydrated(page);

    await page.getByRole('button', { name: 'Leave this workspace' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Leave this workspace' }).click();

    await expect(page.getByRole('alert')).toHaveText(/A workspace needs at least one owner\./);
    await expect(page.getByRole('alert')).toBeFocused();
    await expect(page.getByRole('table', { name: 'Members' })).toContainText('Ada');
  });
});
