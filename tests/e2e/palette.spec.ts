import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

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

test.describe('command palette', () => {
  test('given any signed-in page, the shortcut opens the Search dialog with the focus in its field, and Escape gives the focus back, with no axe violation (1)', async ({ page }) => {
    await page.goto('/settings');
    await hydrated(page);
    const traffic = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Traffic' });
    await traffic.focus();

    await page.keyboard.press(SHORTCUT);

    const dialog = page.getByRole('dialog', { name: 'Search' });
    await expect(dialog.getByRole('combobox')).toBeFocused();
    await expectNoAxeViolation(page);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(traffic).toBeFocused();
  });

  test('given the sidebar, its Search button says the shortcut and opens the palette (1)', async ({ page }) => {
    await page.goto('/settings');
    await hydrated(page);

    await page.getByRole('button', { name: `Search, ${LABEL}` }).click();

    await expect(page.getByRole('dialog', { name: 'Search' }).getByRole('combobox')).toBeFocused();
  });
});
