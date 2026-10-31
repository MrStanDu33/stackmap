import { expect, within } from 'storybook/test';

import AuthTemplate from './AuthTemplate.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Templates/AuthTemplate',
  component: AuthTemplate,
  parameters: { layout: 'fullscreen' },
  args: { title: 'Sign in' },
  render: (args) => ({
    components: { AuthTemplate },
    setup: () => ({ args }),
    template: '<AuthTemplate v-bind="args"><p>The form goes here.</p></AuthTemplate>',
  }),
} satisfies Meta<typeof AuthTemplate>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;

/** No sidebar: an h1, the page's content in the main landmark, and the theme, contrast and language switches (25). */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const main = canvas.getByRole('main');

    await expect(within(main).getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    await expect(within(main).getByText('The form goes here.')).toBeVisible();
    await expect(canvas.queryByRole('navigation')).toBeNull();
    await expect(canvas.getByRole('region', { name: t('preferences.title') })).toBeVisible();
  },
};
