import { expect, fn, userEvent, within } from 'storybook/test';

import AppSidebar from './AppSidebar.vue';
import { i18n, router } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Organisms/AppSidebar',
  component: AppSidebar,
  parameters: { layout: 'fullscreen' },
  beforeEach: async () => {
    await router.push('/graph');
  },
  render: () => ({
    components: { AppSidebar },
    template: '<UDashboardGroup><AppSidebar /></UDashboardGroup>',
  }),
} satisfies Meta<typeof AppSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;

/** The Graph link, marked as the current page, and the display preferences. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const navigation = canvas.getByRole('navigation');

    await expect(within(navigation).getByRole('link', { name: t('traffic.title') })).toHaveAttribute('aria-current', 'page');
    await expect(within(navigation).getByRole('link', { name: t('trace.title') })).not.toHaveAttribute('aria-current');
    await expect(canvas.getByText(t('app.name'))).toBeVisible();
    await expect(canvas.getByRole('region', { name: t('preferences.title') })).toBeVisible();
  },
};

/** Signed in: the footer shows the user's name and Sign out (24). */
export const SignedIn: Story = {
  args: { user: { name: 'Ada' }, onSignOut: fn() },
  render: (args) => ({
    components: { AppSidebar },
    setup: () => ({ args }),
    template: '<UDashboardGroup><AppSidebar v-bind="args" /></UDashboardGroup>',
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Ada')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: t('auth.signOut') }));
    await expect(args.onSignOut).toHaveBeenCalledOnce();
  },
};

/** Collapsed: an icon button named "Sign out (<name>)" (24). */
export const SignedInCollapsed: Story = {
  args: { user: { name: 'Ada' }, onSignOut: fn() },
  render: (args) => ({
    components: { AppSidebar },
    setup: () => ({ args }),
    template: '<UDashboardGroup><AppSidebar v-bind="args" :collapsed="true" /></UDashboardGroup>',
  }),
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: t('auth.signOutOf', { name: 'Ada' }) }));
    await expect(args.onSignOut).toHaveBeenCalledOnce();
  },
};
