import { expect, fn, within } from 'storybook/test';

import KindSelect from './KindSelect.vue';
import { optionTexts, pick } from '../../../.storybook/inventory';
import { i18n, useState } from '../../../.storybook/nuxt-shims';
import { INSTALLED_EXTENSIONS } from '../../../tests/support/extensions';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;
const kind = (id: string) => t(`extensions.core.kinds.host.${id}`);

const meta = {
  title: 'Molecules/KindSelect',
  component: KindSelect,
  args: {
    id: 'host-form-kind',
    label: 'Kind',
    entity: 'host',
    modelValue: 'physical',
    required: true,
    errors: [],
    readonly: false,
    'onUpdate:modelValue': fn(),
  },
} satisfies Meta<typeof KindSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

const select = (canvasElement: HTMLElement) => within(canvasElement).getByRole('combobox', { name: /^Kind/ });

/** The active extensions' kinds of the entity, translated, icons beside the text; picking one sends its id (36). */
export const Translated: Story = {
  play: async ({ canvasElement, args }) => {
    await expect(select(canvasElement)).toHaveTextContent(kind('physical'));
    await expect(await optionTexts(select(canvasElement))).toEqual([kind('physical'), kind('vm'), kind('vps'), kind('router')]);
    await pick(select(canvasElement), kind('vm'));
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith('vm');
  },
};

/** A kind no active extension provides stays as it is, said unavailable, so saving keeps it (edge case). */
export const Unavailable: Story = {
  args: { modelValue: 'mainframe' },
  play: async ({ canvasElement }) => {
    await expect(select(canvasElement)).toHaveTextContent(t('inventory.unavailable', { id: 'mainframe' }));
  },
};

/**
 * A kind of an extension turned off in the workspace is not offered; an entity that has it keeps it, said
 * unavailable under its name (37).
 */
export const FromDisabledExtension: Story = {
  args: { entity: 'service', modelValue: 'reverse-proxy' },
  render: (args) => ({
    components: { KindSelect },
    setup: () => {
      // After the preview's decorator, which loads every extension on.
      useState('extensions').value = INSTALLED_EXTENSIONS
        .map((extension) => ({ ...extension, enabled: extension.id !== 'reverse-proxy' }));
      return { args };
    },
    template: '<KindSelect v-bind="args" />',
  }),
  play: async ({ canvasElement }) => {
    const proxy = t('extensions.reverse-proxy.kinds.service.reverse-proxy');
    await expect(select(canvasElement)).toHaveTextContent(t('inventory.unavailable', { id: proxy }));
    await expect(await optionTexts(select(canvasElement))).not.toContain(proxy);
  },
};

/** An error is said in the field's description (25). */
export const WithError: Story = {
  args: { modelValue: '', errors: ['Required'] },
  play: async ({ canvasElement }) => {
    await expect(select(canvasElement)).toHaveAttribute('aria-invalid', 'true');
    await expect(select(canvasElement)).toHaveAccessibleDescription(expect.stringContaining('Required') as string);
  },
};

/** An optional kind, such as a listener's protocol: None first, which sends null (36). */
export const Nullable: Story = {
  args: { entity: 'protocol', modelValue: 'https', required: false, nullable: true, label: 'Protocol', id: 'listener-form-protocol' },
  play: async ({ canvasElement, args }) => {
    const combobox = within(canvasElement).getByRole('combobox', { name: /^Protocol/ });
    await expect((await optionTexts(combobox))[0]).toBe(t('inventory.none'));
    await pick(combobox, t('inventory.none'));
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith(null);
  },
};

/** Read-only for viewers (18). */
export const ReadOnly: Story = {
  args: { readonly: true },
  play: async ({ canvasElement }) => {
    // Its value as read-only text, reachable and at full contrast, not a disabled select (review).
    const value = within(canvasElement).getByRole('textbox', { name: /^Kind/ });
    await expect(value).toHaveAttribute('readonly');
    await expect(value).toHaveValue(kind('physical'));
    await expect(within(canvasElement).queryByRole('combobox')).toBeNull();
  },
};
