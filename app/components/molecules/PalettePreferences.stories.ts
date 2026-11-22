import { expect, fn, userEvent, within } from 'storybook/test';

import PalettePreferences from './PalettePreferences.vue';
import { i18n } from '../../../.storybook/nuxt-shims';
import { isMac, paletteShortcutLabel } from '../../utils/palette-shortcut';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Molecules/PalettePreferences',
  component: PalettePreferences,
  args: { hidden: [], 'onUpdate:hidden': fn() },
} satisfies Meta<typeof PalettePreferences>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;
const GROUPS = ['entities', 'pages', 'workspaces', 'actions'];
const group = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('group', { name: t('settings.palette.title') });

/** A group of checkboxes named Command palette and described, one per group, all checked by default (13). */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const fieldset = group(canvasElement);
    // This computer's shortcut, as the sidebar shows it (review).
    await expect(fieldset).toHaveAccessibleDescription(t('settings.palette.hint', { shortcut: paletteShortcutLabel(isMac()) }));
    await expect(within(fieldset).getAllByRole('checkbox')).toHaveLength(GROUPS.length);
    for (const id of GROUPS) {
      await expect(within(fieldset).getByRole('checkbox', { name: t(`palette.groups.${id}`) })).toBeChecked();
    }
  },
};

/** Unchecking a group, with the keyboard, sends what is hidden; checking it again shows it (13). */
export const HideAGroup: Story = {
  play: async ({ canvasElement, args }) => {
    const pages = within(group(canvasElement)).getByRole('checkbox', { name: t('palette.groups.pages') });
    pages.focus();
    await userEvent.keyboard(' ');

    await expect(args['onUpdate:hidden']).toHaveBeenCalledWith(['group:pages']);
  },
};

/** Some groups hidden: those are unchecked, and checking one sends the others alone (13). */
export const SomeHidden: Story = {
  args: { hidden: ['group:entities', 'group:actions', 'extension:nat'] },
  play: async ({ canvasElement, args }) => {
    const fieldset = within(group(canvasElement));
    await expect(fieldset.getByRole('checkbox', { name: t('palette.groups.entities') })).not.toBeChecked();
    await expect(fieldset.getByRole('checkbox', { name: t('palette.groups.pages') })).toBeChecked();

    await userEvent.click(fieldset.getByRole('checkbox', { name: t('palette.groups.entities') }));

    // What it does not know (an extension, from the filters to come) is kept as it was.
    await expect(args['onUpdate:hidden']).toHaveBeenCalledWith(['group:actions', 'extension:nat']);
  },
};

/** Hiding a group never adds a key twice: the list stays as the server takes it (review). */
export const NoDuplicates: Story = {
  args: { hidden: ['group:entities', 'group:entities'] },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(group(canvasElement)).getByRole('checkbox', { name: t('palette.groups.pages') }));

    await expect(args['onUpdate:hidden']).toHaveBeenCalledWith(['group:entities', 'group:pages']);
  },
};
