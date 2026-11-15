import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import HiddenOrphans from './HiddenOrphans.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

/** Two port forwards no flow is based on, named as the inventory names them. */
const ITEMS = [
  { entity: 'port-forward', id: '0199d6a0-0000-7000-8000-000000000031', name: 'Edge router 203.0.113.10:8080/tcp', type: 'Port forward' },
  { entity: 'port-forward', id: '0199d6a0-0000-7000-8000-000000000032', name: 'Edge router 203.0.113.10:8443/tcp', type: 'Port forward' },
];

const meta = {
  title: 'Organisms/HiddenOrphans',
  component: HiddenOrphans,
  args: {
    extension: 'nat',
    items: ITEMS,
    truncated: false,
    failed: false,
    canManage: true,
    busy: null,
    onDelete: fn(),
    onKeep: fn(),
    onRetry: fn(),
  },
} satisfies Meta<typeof HiddenOrphans>;

export default meta;
type Story = StoryObj<typeof meta>;

const count = (n: number) => t('workspaceExtensions.orphans', { count: n }, n);
const review = (canvasElement: HTMLElement) => within(canvasElement).getByRole('button', { name: t('workspaceExtensions.review') });
const dialog = () => within(document.body).getByRole('alertdialog');
const name = (index: number) => ITEMS[index]?.name ?? '';

/** With no disconnected entity, nothing is shown (23). */
export const None: Story = {
  args: { items: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent.trim()).toBe('');
  },
};

/** A member reads the count as text, with nothing to open or act on (22). */
export const CountOnly: Story = {
  args: { canManage: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(count(2))).toBeVisible();
    await expect(canvas.queryAllByRole('button')).toEqual([]);
  },
};

/** An admin opens the list from the count: each entity by its name and type, with Delete and Keep hidden (19). */
export const Review: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(count(2))).toBeVisible();
    await expect(review(canvasElement)).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.queryByRole('list')).toBeNull();

    await userEvent.click(review(canvasElement));

    await expect(review(canvasElement)).toHaveAttribute('aria-expanded', 'true');
    const items = canvas.getAllByRole('listitem');
    await expect(items).toHaveLength(2);
    await expect(items[0]).toHaveTextContent(name(0));
    await expect(items[0]).toHaveTextContent('Port forward');
    await expect(canvas.getByRole('button', { name: t('workspaceExtensions.deleteOrphan', { name: name(0) }) })).toBeVisible();
    await expect(canvas.getByRole('button', { name: t('workspaceExtensions.keepOrphan', { name: name(1) }) })).toBeVisible();
  },
};

/** Delete asks first, naming the entity and saying it cannot be undone; confirmed, the page deletes it (20). */
export const Delete: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(review(canvasElement));
    const deleteFirst = t('workspaceExtensions.deleteOrphan', { name: name(0) });
    await userEvent.click(within(canvasElement).getByRole('button', { name: deleteFirst }));

    await waitFor(() => expect(dialog()).toBeVisible());
    await expect(dialog()).toHaveAccessibleDescription(t('workspaceExtensions.confirmDeleteOrphan', { name: name(0) }));
    await waitFor(() => expect(within(dialog()).getByRole('button', { name: t('workspaceExtensions.cancel') })).toHaveFocus());
    await userEvent.click(within(dialog()).getByRole('button', { name: deleteFirst }));

    await expect(args.onDelete).toHaveBeenCalledWith(ITEMS[0]);
  },
};

/** Keep hidden needs no confirmation (21). */
export const Keep: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(review(canvasElement));
    await userEvent.click(within(canvasElement).getByRole('button', { name: t('workspaceExtensions.keepOrphan', { name: name(1) }) }));

    await expect(args.onKeep).toHaveBeenCalledWith(ITEMS[1]);
    await expect(within(document.body).queryByRole('alertdialog')).toBeNull();
  },
};

/** When an entity leaves the list, the focus goes to the next row's first action, or to Review when it empties (20). */
export const FocusAfterAction: Story = {
  render: (args) => ({
    components: { HiddenOrphans },
    setup: () => ({ args }),
    data: () => ({ items: ITEMS }),
    template: '<HiddenOrphans v-bind="args" :items="items" @keep="(item) => { items = items.filter((i) => i.id !== item.id) }" />',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(review(canvasElement));
    await userEvent.click(canvas.getByRole('button', { name: t('workspaceExtensions.keepOrphan', { name: name(0) }) }));

    await waitFor(() => expect(canvas.getByRole('button', { name: t('workspaceExtensions.deleteOrphan', { name: name(1) }) })).toHaveFocus());

    await userEvent.click(canvas.getByRole('button', { name: t('workspaceExtensions.keepOrphan', { name: name(1) }) }));
    await waitFor(() => expect(review(canvasElement)).toHaveFocus());
  },
};

/** The row being changed is busy; its actions do nothing until it is done. */
export const Busy: Story = {
  args: { busy: ITEMS[0]?.id ?? null },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(review(canvasElement));
    const keep = within(canvasElement).getByRole('button', { name: t('workspaceExtensions.keepOrphan', { name: name(0) }) });
    await expect(keep).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(keep);
    await expect(args.onKeep).not.toHaveBeenCalled();
  },
};

/** While the list loads, it says so in words. */
export const Loading: Story = {
  args: { items: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(t('workspaceExtensions.orphansLoading'))).toBeInTheDocument();
  },
};

/** When the list cannot be loaded, it says so and offers to try again. */
export const LoadFailed: Story = {
  args: { items: null, failed: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert')).toHaveTextContent(t('workspaceExtensions.orphansFailed'));
    await userEvent.click(canvas.getByRole('button', { name: t('workspaceExtensions.retry') }));
    await expect(args.onRetry).toHaveBeenCalled();
  },
};

/** When a type had more than the server sends, the list says it shows the first ones. */
export const Truncated: Story = {
  args: { truncated: true },
  play: async ({ canvasElement }) => {
    await userEvent.click(review(canvasElement));
    await expect(within(canvasElement).getByText(t('workspaceExtensions.truncated', { count: 200 }))).toBeVisible();
  },
};
