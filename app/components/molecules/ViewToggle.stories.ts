import { expect, fn, userEvent, within } from 'storybook/test';

import ViewToggle from './ViewToggle.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Molecules/ViewToggle',
  component: ViewToggle,
  args: { modelValue: 'graph', 'onUpdate:modelValue': fn() },
} satisfies Meta<typeof ViewToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;

/** A radio group named "View": the arrow keys move to List and emit it. */
export const Graph: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('radiogroup', { name: t('traffic.view') });
    const graph = within(group).getByRole('radio', { name: t('traffic.graph') });

    await expect(graph).toBeChecked();
    await expect(within(group).getByRole('radio', { name: t('traffic.list') })).not.toBeChecked();
    graph.focus();
    await userEvent.keyboard('{ArrowRight}');

    await expect(args['onUpdate:modelValue']).toHaveBeenCalledWith('list');
  },
};

export const List: Story = {
  args: { modelValue: 'list' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('radio', { name: t('traffic.list') })).toBeChecked();
    await userEvent.click(canvas.getByRole('radio', { name: t('traffic.graph') }));

    await expect(args['onUpdate:modelValue']).toHaveBeenCalledWith('graph');
  },
};
