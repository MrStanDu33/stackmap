import { expect, within } from 'storybook/test';

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

    await expect(within(navigation).getByRole('link', { name: t('nav.graph') })).toHaveAttribute('aria-current', 'page');
    await expect(canvas.getByText(t('app.name'))).toBeVisible();
    await expect(canvas.getByRole('heading', { name: t('preferences.title') })).toBeVisible();
  },
};
