import { expect, userEvent, within } from 'storybook/test';

import AppShell from './AppShell.vue';
import { clearNuxtState, i18n, router, useState } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Templates/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen' },
  beforeEach: async () => {
    await router.push('/graph');
  },
  render: () => ({
    components: { AppShell },
    template: '<AppShell><h1 class="p-4 text-2xl">Page title</h1></AppShell>',
  }),
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;

/** A skip link first, the sidebar with Graph as the current page, and one main landmark holding the page. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const main = canvas.getByRole('main');

    await userEvent.tab();
    const skip = canvas.getByRole('link', { name: t('a11y.skipToContent') });
    await expect(skip).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(main).toHaveFocus();

    await expect(canvas.getAllByRole('main')).toHaveLength(1);
    await expect(within(main).getByRole('heading', { name: 'Page title' })).toBeVisible();
    await expect(within(canvas.getByRole('navigation')).getByRole('link', { name: t('traffic.title') }))
      .toHaveAttribute('aria-current', 'page');
  },
};

/** A saved preference is announced once, by the shell, whatever shows the preferences (4, review). */
export const AnnouncesSaved: Story = {
  beforeEach: () => {
    useState('preferences.status').value = 'saved';
    return clearNuxtState;
  },
  play: async ({ canvasElement }) => {
    const statuses = within(canvasElement).getAllByRole('status').filter((status) => status.textContent.trim() !== '');

    await expect(statuses.map((status) => status.textContent.trim())).toEqual([t('settings.saved')]);
  },
};

/** A preference that could not be saved is one alert, from the shell (4, review). */
export const AnnouncesSaveFailed: Story = {
  beforeEach: () => {
    useState('preferences.status').value = 'error';
    return clearNuxtState;
  },
  play: async ({ canvasElement }) => {
    const alerts = within(canvasElement).getAllByRole('alert');

    await expect(alerts.map((alert) => alert.textContent.trim())).toEqual([t('settings.saveError')]);
  },
};

/** A page's notice for the next one (the forced password change) is announced there (13, review). */
export const AnnouncesNotice: Story = {
  beforeEach: () => {
    useState('app.notice').value = t('settings.passwordChanged');
    return clearNuxtState;
  },
  play: async ({ canvasElement }) => {
    const statuses = within(canvasElement).getAllByRole('status').map((status) => status.textContent.trim());

    await expect(statuses).toContain(t('settings.passwordChanged'));
  },
};
