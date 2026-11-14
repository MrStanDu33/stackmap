import { expect, fn, userEvent, within } from 'storybook/test';

import LandingPageSelect from './LandingPageSelect.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Molecules/LandingPageSelect',
  component: LandingPageSelect,
  args: { modelValue: null, 'onUpdate:modelValue': fn() },
} satisfies Meta<typeof LandingPageSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;

/** A radio group with a legend and a description; Graph is checked when nothing was chosen (6). */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('radiogroup', { name: t('settings.landingPage') });

    await expect(group).toHaveAccessibleDescription(t('settings.landingPageHint'));
    await expect(canvas.getByRole('radio', { name: t('settings.landing.graph') })).toBeChecked();
    await expect(canvas.getByRole('radio', { name: t('settings.landing.trace') })).not.toBeChecked();
  },
};

/** Choosing Trace, with the keyboard, sends it (6). */
export const ChooseTrace: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // Tab into the group lands on the checked radio, as a keyboard user would.
    await userEvent.tab();
    await expect(canvas.getByRole('radio', { name: t('settings.landing.graph') })).toHaveFocus();

    // The arrow moves to Trace; Space checks it (Nuxt UI's radio group, like the display preferences').
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getByRole('radio', { name: t('settings.landing.trace') })).toHaveFocus();
    await userEvent.keyboard(' ');

    await expect(args['onUpdate:modelValue']).toHaveBeenCalledWith('trace');
  },
};

/** Trace chosen: it is the one checked. */
export const TraceChosen: Story = {
  args: { modelValue: 'trace' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('radio', { name: t('settings.landing.trace') })).toBeChecked();
  },
};
