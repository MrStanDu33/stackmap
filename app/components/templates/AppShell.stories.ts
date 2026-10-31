import { expect, userEvent, within } from 'storybook/test';

import AppShell from './AppShell.vue';
import { i18n, router } from '../../../.storybook/nuxt-shims';

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
    await expect(within(canvas.getByRole('navigation')).getByRole('link', { name: t('nav.graph') }))
      .toHaveAttribute('aria-current', 'page');
  },
};
