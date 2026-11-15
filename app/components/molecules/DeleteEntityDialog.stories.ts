import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ref } from 'vue';

import DeleteEntityDialog from './DeleteEntityDialog.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

const meta = {
  title: 'Molecules/DeleteEntityDialog',
  component: DeleteEntityDialog,
  args: { open: true, name: 'nas', busy: false, failed: false, inUse: null, onConfirm: fn(), 'onUpdate:open': fn() },
  // Dependents' names are i18n keys, translated when the story renders: in its locale.
  render: (args) => ({
    components: { DeleteEntityDialog },
    setup: () => ({
      args: {
        ...args,
        // Props reach stories untyped from the .vue file: typed here.
        inUse: Array.isArray(args.inUse)
          ? (args.inUse as { label: string; count: number }[]).map(({ label, count }) => ({ label: t(label), count }))
          : args.inUse as 'unknown' | null,
      },
    }),
    template: '<DeleteEntityDialog v-bind="args" />',
  }),
} satisfies Meta<typeof DeleteEntityDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const dialog = () => within(document.body).getByRole('alertdialog');
// toHaveTextContent normalizes the page's whitespace, French non-breaking spaces included, not the expected text.
const text = (value: string) => value.replace(/\s+/g, ' ');

/** Names the entity and says it cannot be undone; Delete confirms, Cancel closes (45). */
export const Confirm: Story = {
  play: async ({ args }) => {
    await waitFor(() => expect(dialog()).toBeVisible());
    await expect(dialog()).toHaveTextContent(text(t('inventory.confirmDelete', { name: 'nas' })));
    // The least destructive answer takes the focus (review).
    await waitFor(() => expect(within(dialog()).getByRole('button', { name: t('inventory.cancel') })).toHaveFocus());
    await userEvent.click(within(dialog()).getByRole('button', { name: t('inventory.delete', { name: 'nas' }) }));
    await expect(args.onConfirm).toHaveBeenCalled();
  },
};

/** Cancel closes without deleting (45). */
export const Cancel: Story = {
  play: async ({ args }) => {
    await waitFor(() => expect(dialog()).toBeVisible());
    await userEvent.click(within(dialog()).getByRole('button', { name: t('inventory.cancel') }));
    await expect(args['onUpdate:open']).toHaveBeenCalledWith(false);
    await expect(args.onConfirm).not.toHaveBeenCalled();
  },
};

/** Deleting: the button says it is busy and unavailable, keeps the focus, and sends nothing more (review). */
export const Busy: Story = {
  args: { busy: true },
  play: async ({ args }) => {
    await waitFor(() => expect(dialog()).toBeVisible());
    const remove = within(dialog()).getByRole('button', { name: t('inventory.delete', { name: 'nas' }) });
    await expect(remove).toHaveAttribute('aria-disabled', 'true');
    await expect(remove).not.toBeDisabled();
    await userEvent.click(remove);
    await expect(args.onConfirm).not.toHaveBeenCalled();
  },
};

/** Refused once open: the alert takes the focus, since the focused Delete button goes away (review). */
export const RefusedWhileOpen: Story = {
  render: (args) => ({
    components: { DeleteEntityDialog },
    setup: () => {
      const inUse = ref<{ label: string; count: number }[] | null>(null);
      const confirm = () => {
        inUse.value = [{ label: t('extensions.core.entitiesPlural.service'), count: 2 }];
      };
      return { args, inUse, confirm };
    },
    template: '<DeleteEntityDialog v-bind="args" :in-use="inUse" @confirm="confirm" />',
  }),
  play: async () => {
    await waitFor(() => expect(dialog()).toBeVisible());
    await userEvent.click(within(dialog()).getByRole('button', { name: t('inventory.delete', { name: 'nas' }) }));
    await waitFor(() => expect(within(dialog()).getByRole('alert')).toHaveFocus());
  },
};

/** The deletion failed: said as an alert in the dialog, which stays open to try again (review). */
export const Failed: Story = {
  args: { failed: true },
  play: async () => {
    await waitFor(() => expect(dialog()).toBeVisible());
    await expect(within(dialog()).getByRole('alert')).toHaveTextContent(text(t('inventory.deleteFailed', { name: 'nas' })));
    await expect(within(dialog()).getByRole('button', { name: t('inventory.delete', { name: 'nas' }) })).toBeVisible();
  },
};

/** Refused while others use it: an alert lists each dependent with its count and translated name (47). */
export const InUse: Story = {
  args: { inUse: [{ label: 'extensions.core.entitiesPlural.service', count: 2 }, { label: 'extensions.nat.entities.port-forward', count: 1 }] },
  play: async () => {
    await waitFor(() => expect(dialog()).toBeVisible());
    const alert = within(dialog()).getByRole('alert');
    await expect(alert).toHaveTextContent(text(t('inventory.inUse', { name: 'nas' })));
    await expect(within(alert).getAllByRole('listitem').map(({ textContent }) => text(textContent.trim()))).toEqual([
      text(t('inventory.inUseCount', { count: 2, entity: t('extensions.core.entitiesPlural.service') })),
      text(t('inventory.inUseCount', { count: 1, entity: t('extensions.nat.entities.port-forward') })),
    ]);
    await expect(within(dialog()).queryByRole('button', { name: t('inventory.delete', { name: 'nas' }) })).toBeNull();
  },
};

/** Refused, with the dependents unknown: "other entities" (47). */
export const InUseUnknown: Story = {
  args: { inUse: 'unknown' },
  play: async () => {
    await waitFor(() => expect(dialog()).toBeVisible());
    await expect(within(dialog()).getByRole('alert')).toHaveTextContent(text(t('inventory.inUseUnknown')));
  },
};
