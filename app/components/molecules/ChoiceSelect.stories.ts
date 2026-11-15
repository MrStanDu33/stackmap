import UFormField from '@nuxt/ui/components/FormField.vue';
import { expect, fn, within } from 'storybook/test';

import ChoiceSelect from './ChoiceSelect.vue';
import { optionTexts, pick } from '../../../.storybook/inventory';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const ITEMS = [{ value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }];

const meta = {
  title: 'Molecules/ChoiceSelect',
  component: ChoiceSelect,
  args: { id: 'listener-form-transport', modelValue: 'tcp', items: ITEMS, readonly: false, 'onUpdate:modelValue': fn() },
  render: (args) => ({
    components: { ChoiceSelect, UFormField },
    setup: () => ({ args }),
    template: '<UFormField label="Transport"><ChoiceSelect v-bind="args" /></UFormField>',
  }),
} satisfies Meta<typeof ChoiceSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A select of fixed choices, by their labels; picking one sends its value. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const select = within(canvasElement).getByRole('combobox', { name: 'Transport' });
    await expect(select).toHaveTextContent('TCP');
    await expect(await optionTexts(select)).toEqual(['TCP', 'UDP']);
    await pick(select, 'UDP');
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith('udp');
  },
};

/** Read-only: the chosen label as read-only text, reachable and at full contrast, not a disabled select (review). */
export const ReadOnly: Story = {
  args: { readonly: true, modelValue: 'udp' },
  play: async ({ canvasElement }) => {
    const value = within(canvasElement).getByRole('textbox', { name: 'Transport' });
    await expect(value).toHaveValue('UDP');
    await expect(value).toHaveAttribute('readonly');
    await expect(value).toHaveAttribute('id', 'listener-form-transport');
    await expect(within(canvasElement).queryByRole('combobox')).toBeNull();
  },
};
