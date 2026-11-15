import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import EntitySlideover from './EntitySlideover.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;
const TYPE = () => t('extensions.core.entities.host');

const meta = {
  title: 'Organisms/EntitySlideover',
  component: EntitySlideover,
  args: {
    open: true,
    // i18n keys, translated when the story renders: in its locale, not the one the file loaded in.
    title: 'inventory.new',
    typeLabel: 'extensions.core.entities.host',
    formId: 'host-form',
    readonly: false,
    saving: false,
    dirty: false,
    summary: [],
    state: null,
    'onUpdate:open': fn(),
    onReload: fn(),
  },
  // A stand-in form in the slot: what every type's form renders.
  render: (args) => ({
    components: { EntitySlideover },
    setup: () => ({
      args: {
        ...args,
        // Props reach stories untyped from the .vue file: typed here.
        title: i18n.global.te(args.title as string) ? t(args.title as string, { type: TYPE(), name: 'nas' }) : args.title as string,
        typeLabel: t(args.typeLabel as string),
      },
    }),
    template: `<EntitySlideover v-bind="args">
      <form id="host-form" @submit.prevent>
        <label for="host-form-name">Name</label><input id="host-form-name" name="name">
        <label for="host-form-os">OS</label><input id="host-form-os" name="os">
      </form>
    </EntitySlideover>`,
  }),
} satisfies Meta<typeof EntitySlideover>;

export default meta;
type Story = StoryObj<typeof meta>;

const panel = async (name: string) => {
  const dialog = await waitFor(() => within(document.body).getByRole('dialog', { name }));
  return within(dialog);
};

/** New: titled "New <type>", focus on the form's first field; Save submits the form (20). */
export const New: Story = {
  play: async () => {
    const dialog = await panel(t('inventory.new', { type: TYPE() }));
    await waitFor(() => expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveFocus());
    await expect(dialog.getByRole('button', { name: t('inventory.save') })).toHaveAttribute('form', 'host-form');
    await expect(dialog.getByRole('button', { name: t('inventory.save') })).toHaveAttribute('type', 'submit');
    // The asterisk of required fields is explained in words (review).
    await expect(dialog.getByText(t('inventory.requiredHint'))).toBeVisible();
  },
};

/** Edit: titled with the entity's name (22). */
export const Edit: Story = {
  args: { title: 'inventory.edit' },
  play: async () => {
    await panel(t('inventory.edit', { name: 'nas' }));
  },
};

/** Read-only for viewers: no Save, a Close (18). */
export const ReadOnly: Story = {
  args: { title: 'nas', readonly: true },
  play: async ({ args }) => {
    const dialog = await panel('nas');
    await expect(dialog.queryByRole('button', { name: t('inventory.save') })).toBeNull();
    await expect(dialog.queryByText(t('inventory.requiredHint'))).toBeNull();
    await userEvent.click(dialog.getByRole('button', { name: t('inventory.close') }));
    await expect(args['onUpdate:open']).toHaveBeenCalledWith(false);
  },
};

/** Saving: Save says it is busy and unavailable, yet keeps the focus, which a disabled button would drop (review). */
export const Saving: Story = {
  args: { saving: true },
  play: async () => {
    const dialog = await panel(t('inventory.new', { type: TYPE() }));
    const save = dialog.getByRole('button', { name: t('inventory.save') });
    await expect(save).toHaveAttribute('aria-disabled', 'true');
    await expect(save).toHaveAttribute('aria-busy', 'true');
    await expect(save).not.toBeDisabled();
  },
};

/** Issues no field shows, and those it does, in a summary that takes the focus and links to each field (25). */
export const Issues: Story = {
  args: {
    summary: [
      { path: 'name', message: 'Too short' },
      { path: null, message: 'Unrecognized key: colour' },
    ],
  },
  play: async () => {
    const dialog = await panel(t('inventory.new', { type: TYPE() }));
    const summary = dialog.getByRole('alert');
    await waitFor(() => expect(summary).toHaveFocus());
    // Whitespace normalized, as toHaveTextContent does to the page: French has non-breaking spaces.
    await expect(summary).toHaveTextContent(t('inventory.errorSummary', { type: TYPE() }).replace(/\s+/g, ' '));
    await expect(summary).toHaveTextContent('Unrecognized key: colour');
    await userEvent.click(within(summary).getByRole('link', { name: /Too short/ }));
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveFocus();
  },
};

/** Changed by someone else: said, with Reload, which asks before discarding the changes (30). */
export const Changed: Story = {
  args: { title: 'inventory.edit', state: 'changed', dirty: true },
  play: async ({ args }) => {
    const dialog = await panel(t('inventory.edit', { name: 'nas' }));
    await expect(dialog.getByRole('alert')).toHaveTextContent(t('inventory.changed'));
    await userEvent.click(dialog.getByRole('button', { name: t('inventory.reload') }));
    const confirm = await waitFor(() => within(document.body).getByRole('alertdialog', { name: t('inventory.discard') }));
    await userEvent.click(within(confirm).getByRole('button', { name: t('inventory.discardConfirm') }));
    await expect(args.onReload).toHaveBeenCalled();
  },
};

/** Deleted meanwhile: said (31). */
export const Gone: Story = {
  args: { title: 'inventory.edit', state: 'gone' },
  play: async () => {
    const dialog = await panel(t('inventory.edit', { name: 'nas' }));
    await expect(dialog.getByRole('alert')).toHaveTextContent(t('inventory.gone'));
  },
};

/** A network failure: said, and the values stay (32). */
export const NetworkFailure: Story = {
  args: { state: 'network', dirty: true },
  play: async () => {
    const dialog = await panel(t('inventory.new', { type: TYPE() }));
    await expect(dialog.getByRole('alert')).toHaveTextContent(t('inventory.notSaved'));
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toBeVisible();
  },
};

/** The role changed meanwhile: said it is not allowed (edge case). */
export const Forbidden: Story = {
  args: { state: 'forbidden' },
  play: async () => {
    const dialog = await panel(t('inventory.new', { type: TYPE() }));
    await expect(dialog.getByRole('alert')).toHaveTextContent(t('inventory.forbidden'));
  },
};

/** Closing with unsaved changes asks first; Keep editing stays, Discard closes (33). */
export const DiscardQuestion: Story = {
  args: { dirty: true },
  play: async ({ args }) => {
    const dialog = await panel(t('inventory.new', { type: TYPE() }));
    await userEvent.click(dialog.getByRole('button', { name: t('inventory.cancel') }));
    let confirm = await waitFor(() => within(document.body).getByRole('alertdialog', { name: t('inventory.discard') }));
    // The least destructive answer takes the focus (review).
    await waitFor(() => expect(within(confirm).getByRole('button', { name: t('inventory.keepEditing') })).toHaveFocus());
    await userEvent.click(within(confirm).getByRole('button', { name: t('inventory.keepEditing') }));
    await expect(args['onUpdate:open']).not.toHaveBeenCalled();
    // Gone before Escape: a question still closing would take the key.
    await waitFor(() => expect(within(document.body).queryByRole('alertdialog')).toBeNull());

    await userEvent.keyboard('{Escape}');
    confirm = await waitFor(() => within(document.body).getByRole('alertdialog', { name: t('inventory.discard') }));
    await userEvent.click(within(confirm).getByRole('button', { name: t('inventory.discardConfirm') }));
    await expect(args['onUpdate:open']).toHaveBeenCalledWith(false);
  },
};

/** Without changes, Cancel closes at once (33). */
export const CleanClose: Story = {
  play: async ({ args }) => {
    const dialog = await panel(t('inventory.new', { type: TYPE() }));
    await userEvent.click(dialog.getByRole('button', { name: t('inventory.cancel') }));
    await expect(args['onUpdate:open']).toHaveBeenCalledWith(false);
    await expect(within(document.body).queryByRole('alertdialog')).toBeNull();
  },
};
