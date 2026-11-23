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

const EXTENSIONS = [
  { id: 'core', name: 'extensions.core.name', entities: [{ id: 'host', label: 'extensions.core.entities.host' }] },
  { id: 'nat', name: 'extensions.nat.name', entities: [{ id: 'port-forward', label: 'extensions.nat.entities.port-forward' }] },
];
const checkbox = (canvasElement: HTMLElement, key: string) =>
  within(group(canvasElement)).getByRole('checkbox', { name: t(key) });

/** Under Entities, every extension and each of its entity types, each with a checkbox, all checked (17). */
export const ExtensionsAndTypes: Story = {
  args: { extensions: EXTENSIONS },
  play: async ({ canvasElement }) => {
    await expect(within(group(canvasElement)).getAllByRole('checkbox')).toHaveLength(GROUPS.length + 4);
    for (const key of ['extensions.core.name', 'extensions.core.entities.host', 'extensions.nat.name', 'extensions.nat.entities.port-forward']) {
      await expect(checkbox(canvasElement, key)).toBeChecked();
      await expect(checkbox(canvasElement, key)).toBeEnabled();
    }
    // Under Entities, in a group named for it: a screen reader hears where they belong.
    const entities = within(group(canvasElement)).getByRole('group', { name: t('settings.palette.entitiesLegend') });
    await expect(within(entities).getAllByRole('checkbox')).toHaveLength(4);
  },
};

/** Unchecking a type sends its key; the other keys are kept (17). */
export const HideAType: Story = {
  args: { extensions: EXTENSIONS, hidden: ['group:pages'] },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(checkbox(canvasElement, 'extensions.nat.entities.port-forward'));

    await expect(args['onUpdate:hidden']).toHaveBeenCalledWith(['group:pages', 'type:nat/port-forward']);
  },
};

/**
 * Unchecking an extension sends its key; hidden, its types cannot be changed, and checking it shows it again (17).
 */
export const HideAnExtension: Story = {
  args: { extensions: EXTENSIONS, hidden: ['extension:nat'] },
  play: async ({ canvasElement, args }) => {
    await expect(checkbox(canvasElement, 'extensions.nat.name')).not.toBeChecked();
    await expect(checkbox(canvasElement, 'extensions.nat.entities.port-forward')).toBeDisabled();
    // Disabled, it says why (review).
    await expect(checkbox(canvasElement, 'extensions.nat.entities.port-forward'))
      .toHaveAccessibleDescription(t('settings.palette.extensionOff', { name: t('extensions.nat.name') }));
    await expect(checkbox(canvasElement, 'extensions.core.entities.host')).not.toHaveAccessibleDescription();

    await userEvent.click(checkbox(canvasElement, 'extensions.nat.name'));
    await expect(args['onUpdate:hidden']).toHaveBeenLastCalledWith([]);

    await userEvent.click(checkbox(canvasElement, 'extensions.core.name'));
    await expect(args['onUpdate:hidden']).toHaveBeenLastCalledWith(['extension:nat', 'extension:core']);
  },
};

/** With Entities unchecked, the extensions and types cannot be changed, and say why (17). */
export const EntitiesHidden: Story = {
  args: { extensions: EXTENSIONS, hidden: ['group:entities'] },
  play: async ({ canvasElement }) => {
    for (const key of ['extensions.core.name', 'extensions.nat.entities.port-forward']) {
      await expect(checkbox(canvasElement, key)).toBeDisabled();
    }
    await expect(within(group(canvasElement)).getByText(t('settings.palette.entitiesOff'))).toBeVisible();
    // Said on the Entities checkbox too, where the user is: the disabled ones cannot be reached with Tab (review).
    await expect(checkbox(canvasElement, 'palette.groups.entities')).toHaveAccessibleDescription(t('settings.palette.entitiesOff'));
  },
};
