import UInput from '@nuxt/ui/components/Input.vue';
import { expect, within } from 'storybook/test';

import EntityField from './EntityField.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

const meta = {
  title: 'Molecules/EntityField',
  component: EntityField,
  args: { label: 'Name', required: false, errors: [], hint: undefined },
  render: (args) => ({
    components: { EntityField, UInput },
    setup: () => ({ args }),
    template: '<EntityField v-bind="args"><UInput id="site-form-name" /></EntityField>',
  }),
} satisfies Meta<typeof EntityField>;

export default meta;
type Story = StoryObj<typeof meta>;

const input = (canvasElement: HTMLElement) => within(canvasElement).getByRole('textbox');

/** A labelled field; the field inside keeps its own id, which the error summary links to. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(input(canvasElement)).toHaveAccessibleName('Name');
    await expect(input(canvasElement)).toHaveAttribute('id', 'site-form-name');
  },
};

/** Required: said in the name, in words, not only with a mark (a11y). */
export const Required: Story = {
  args: { required: true },
  play: async ({ canvasElement }) => {
    await expect(input(canvasElement)).toHaveAccessibleName(`Name ${t('inventory.required')}`);
  },
};

/** A hint and errors: in the field's description; the field is marked invalid (25). */
export const WithErrors: Story = {
  args: { hint: 'Under the desk', errors: ['Too long', 'Taken'] },
  play: async ({ canvasElement }) => {
    await expect(input(canvasElement)).toHaveAttribute('aria-invalid', 'true');
    await expect(input(canvasElement)).toHaveAccessibleDescription(expect.stringContaining('Too long') as string);
    await expect(input(canvasElement)).toHaveAccessibleDescription(expect.stringContaining('Taken') as string);
  },
};
