import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ref } from 'vue';

import CommonFields from './CommonFields.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

const EMPTY = { status: 'active', tags: [] as string[], notes: '', links: [] as { label: string; url: string }[] };

const meta = {
  title: 'Molecules/CommonFields',
  component: CommonFields,
  args: {
    formId: 'host-form',
    modelValue: EMPTY,
    issues: {},
    readonly: false,
    origin: 'manual',
    externalRef: null,
    'onUpdate:modelValue': fn(),
  },
  // Held, as a form holds its values: each change is the next value.
  render: (args) => ({
    components: { CommonFields },
    setup: () => {
      // Props reach stories untyped from the .vue file: typed here.
      const values = ref(args.modelValue as typeof EMPTY);
      const update = (value: typeof EMPTY) => {
        values.value = value;
        (args['onUpdate:modelValue'] as (value: typeof EMPTY) => void)(value);
      };
      return { args, values, update };
    },
    template: '<CommonFields v-bind="args" :model-value="values" @update:model-value="update" />',
  }),
} satisfies Meta<typeof CommonFields>;

export default meta;
type Story = StoryObj<typeof meta>;

const field = (canvasElement: HTMLElement, role: 'combobox' | 'textbox', key: string) =>
  within(canvasElement).getByRole(role, { name: new RegExp(`^${t(`inventory.common.${key}`)}`) });

/** Status, tags, notes and links, each labelled; the status shows as text (34). */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    await expect(field(canvasElement, 'combobox', 'status')).toHaveTextContent(t('inventory.status.active'));
    await expect(field(canvasElement, 'textbox', 'notes')).toHaveValue('');
    await userEvent.type(field(canvasElement, 'textbox', 'notes'), 'Under the desk');
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith(expect.objectContaining({ notes: 'Under the desk' }));
    // No origin or external reference for a manual entity.
    await expect(within(canvasElement).queryByText(t('inventory.common.origin'))).toBeNull();
  },
};

/** Tags: typed and added with Enter, each once (34). */
export const Tags: Story = {
  play: async ({ canvasElement, args }) => {
    const tags = within(canvasElement).getByRole('textbox', { name: new RegExp(`^${t('inventory.common.tags')}`) });
    await userEvent.type(tags, 'storage{Enter}backup{Enter}');
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ['storage', 'backup'] }));
  },
};

/** Links: Add a link gives a label and a URL field, focused; Remove takes the row away (34). */
export const Links: Story = {
  args: { modelValue: { ...EMPTY, links: [{ label: 'Admin page', url: 'https://nas.homelab.example' }] } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', { name: new RegExp(`^${t('inventory.common.labelNumbered', { number: 1 })}`) })).toHaveValue('Admin page');

    await userEvent.click(canvas.getByRole('button', { name: t('inventory.common.addLink') }));
    const label = canvas.getByRole('textbox', { name: new RegExp(`^${t('inventory.common.labelNumbered', { number: 2 })}`) });
    await expect(label).toHaveFocus();
    await userEvent.type(label, 'Docs');
    await userEvent.type(canvas.getByRole('textbox', { name: new RegExp(`^${t('inventory.common.urlNumbered', { number: 2 })}`) }), 'https://docs.homelab.example');
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith(expect.objectContaining({
      links: [{ label: 'Admin page', url: 'https://nas.homelab.example' }, { label: 'Docs', url: 'https://docs.homelab.example' }],
    }));

    await userEvent.click(canvas.getByRole('button', { name: t('inventory.common.removeLink', { number: 1 }) }));
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith(expect.objectContaining({
      links: [{ label: 'Docs', url: 'https://docs.homelab.example' }],
    }));
    // The removed row's button had the focus: it goes to the row now in its place, not nowhere (review).
    await waitFor(() => expect(canvas.getByRole('button', { name: t('inventory.common.removeLink', { number: 1 }) })).toHaveFocus());
    // The last row removed: to Add a link.
    await userEvent.click(canvas.getByRole('button', { name: t('inventory.common.removeLink', { number: 1 }) }));
    await waitFor(() => expect(canvas.getByRole('button', { name: t('inventory.common.addLink') })).toHaveFocus());
  },
};

/** An imported entity shows its origin and external reference, read-only (34). */
export const Imported: Story = {
  args: { origin: 'connector:proxmox', externalRef: 'vm-104' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(t('inventory.common.origin'))).toBeVisible();
    await expect(canvas.getByText('connector:proxmox')).toBeVisible();
    await expect(canvas.getByText('vm-104')).toBeVisible();
    await expect(canvas.queryByRole('textbox', { name: t('inventory.common.externalRef') })).toBeNull();
  },
};

/** An issue on a link's URL is said under that field (27). */
export const WithIssues: Story = {
  args: {
    modelValue: { ...EMPTY, links: [{ label: 'Admin page', url: 'nas' }] },
    issues: { 'links.0.url': ['Must be an http or https URL'] },
  },
  play: async ({ canvasElement }) => {
    const url = within(canvasElement).getByRole('textbox', { name: new RegExp(`^${t('inventory.common.urlNumbered', { number: 1 })}`) });
    await expect(url).toHaveAttribute('aria-invalid', 'true');
    await expect(url).toHaveAccessibleDescription(expect.stringContaining('Must be an http or https URL') as string);
    await expect(url).toHaveAttribute('id', 'host-form-links-0-url');
  },
};

/** An issue on the links as a whole: said, and tied to their group, which the summary can link to (review). */
export const GroupIssue: Story = {
  args: { issues: { links: ['At most 20 links'] } },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: t('inventory.common.links') });
    await expect(group).toHaveAccessibleDescription(expect.stringContaining('At most 20 links') as string);
    await expect(group).toHaveAttribute('id', 'host-form-links');
  },
};

/** Read-only for viewers: nothing to add, remove or type (18). */
export const ReadOnly: Story = {
  args: { readonly: true, modelValue: { ...EMPTY, notes: 'Under the desk', links: [{ label: 'Admin page', url: 'https://nas.homelab.example' }] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(field(canvasElement, 'textbox', 'notes')).toHaveAttribute('readonly');
    await expect(canvas.queryByRole('button', { name: t('inventory.common.addLink') })).toBeNull();
    await expect(canvas.queryByRole('button', { name: t('inventory.common.removeLink', { number: 1 }) })).toBeNull();
    // Values as text and links as links, reachable and at full contrast: no disabled controls (review).
    await expect(canvas.queryAllByRole('combobox')).toEqual([]);
    await expect(field(canvasElement, 'textbox', 'status')).toHaveValue(t('inventory.status.active'));
    await expect(field(canvasElement, 'textbox', 'status')).toHaveAttribute('readonly');
    await expect(canvas.getByRole('link', { name: 'Admin page' })).toHaveAttribute('href', 'https://nas.homelab.example');
    await expect(canvasElement.querySelectorAll('[disabled]')).toHaveLength(0);
  },
};
