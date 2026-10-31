import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

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
    const signOut = within(canvasElement).getByRole('button', { name: t('auth.signOutOf', { name: 'Ada' }) });

    // Icons alone: a tooltip shows each name to sighted users too, after the usual hover delay (700 ms). It is what is
    // seen that counts: screen readers have the button's name already, so Reka hides the tooltip's copy from them.
    const delay = { timeout: 2000 };
    const shownTooltip = () => document.querySelector('[data-reka-popper-content-wrapper] [data-slot="content"]');
    await userEvent.hover(signOut);
    await waitFor(() => expect(shownTooltip()).toHaveTextContent(t('auth.signOutOf', { name: 'Ada' })), delay);
    await userEvent.hover(within(canvasElement).getByRole('link', { name: t('trace.title') }));
    await waitFor(() => expect(shownTooltip()).toHaveTextContent(t('trace.title')), delay);

    await userEvent.click(signOut);
    await expect(args.onSignOut).toHaveBeenCalledOnce();
  },
};

/** In a workspace: the switcher names it, and the links stay in it (22). */
export const WithWorkspaces: Story = {
  args: {
    user: { name: 'Ada' },
    workspaces: [{ name: 'Demo', slug: 'demo', role: 'owner' }, { name: 'Homelab', slug: 'homelab', role: 'viewer' }],
    current: 'demo',
    canCreate: true,
  },
  beforeEach: async () => {
    await router.push('/w/demo/graph');
  },
  render: (args) => ({
    components: { AppSidebar },
    setup: () => ({ args }),
    template: '<UDashboardGroup><AppSidebar v-bind="args" /></UDashboardGroup>',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const navigation = canvas.getByRole('navigation');

    await expect(canvas.getByRole('button', { name: t('workspace.switcher', { name: 'Demo' }) })).toBeVisible();
    await expect(within(navigation).getByRole('link', { name: t('traffic.title') })).toHaveAttribute('href', '/w/demo/graph');
    await expect(within(navigation).getByRole('link', { name: t('traffic.title') })).toHaveAttribute('aria-current', 'page');
    await expect(within(navigation).getByRole('link', { name: t('trace.title') })).toHaveAttribute('href', '/w/demo/trace');
  },
};
