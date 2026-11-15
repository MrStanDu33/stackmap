import { expect, fn, userEvent, within } from 'storybook/test';

import ExtensionsList from './ExtensionsList.vue';
import { i18n } from '../../../.storybook/nuxt-shims';
import { INSTALLED_EXTENSIONS } from '../../../tests/support/extensions';

import type { WorkspaceExtension } from '../../../shared/contracts/extensions';
import type { Meta, StoryObj } from '@storybook/vue3-vite';

const { t } = i18n.global;

/** The built-in extensions in a workspace where NAT is off. */
const EXTENSIONS: WorkspaceExtension[] = INSTALLED_EXTENSIONS.map((extension) => ({ ...extension, enabled: extension.id !== 'nat' }));

const meta = {
  title: 'Organisms/ExtensionsList',
  component: ExtensionsList,
  args: { extensions: EXTENSIONS, failed: false, canManage: false, busy: null, onToggle: fn(), onRetry: fn() },
} satisfies Meta<typeof ExtensionsList>;

export default meta;
type Story = StoryObj<typeof meta>;

const name = (id: string) => t(`extensions.${id}.name`);
const item = (canvasElement: HTMLElement, id: string) =>
  within(within(canvasElement).getByRole('heading', { name: name(id) }).closest('li') ?? canvasElement);

/** Every extension with its name, description and version; members read On or Off, with no switch (24, 25). */
export const MemberReadOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3);
    for (const { id, description, version } of EXTENSIONS) {
      await expect(item(canvasElement, id).getByText(t(description))).toBeVisible();
      await expect(item(canvasElement, id).getByText(t('workspaceExtensions.version', { version }))).toBeVisible();
    }
    await expect(item(canvasElement, 'core').getByText(t('workspaceExtensions.alwaysOn'))).toBeVisible();
    await expect(item(canvasElement, 'reverse-proxy').getByText(t('workspaceExtensions.on'))).toBeVisible();
    await expect(item(canvasElement, 'nat').getByText(t('workspaceExtensions.off'))).toBeVisible();
    await expect(canvas.queryAllByRole('switch')).toEqual([]);
  },
};

/** Admins get a switch named after each extension, the core excepted: it is always on (26). */
export const AdminSwitches: Story = {
  args: { canManage: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('switch')).toHaveLength(2);
    await expect(canvas.getByRole('switch', { name: name('reverse-proxy') })).toBeChecked();
    await expect(canvas.getByRole('switch', { name: name('nat') })).not.toBeChecked();
    await expect(item(canvasElement, 'core').queryByRole('switch')).toBeNull();
    await expect(item(canvasElement, 'core').getByText(t('workspaceExtensions.alwaysOn'))).toBeVisible();
  },
};

/** Flipping a switch asks to turn the extension on or off; the list itself waits for the stored state (27, 29). */
export const Toggle: Story = {
  args: { canManage: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('switch', { name: name('reverse-proxy') }));
    await expect(args.onToggle).toHaveBeenLastCalledWith('reverse-proxy', false);
    await expect(canvas.getByRole('switch', { name: name('reverse-proxy') })).toBeChecked();
    await userEvent.click(canvas.getByRole('switch', { name: name('nat') }));
    await expect(args.onToggle).toHaveBeenLastCalledWith('nat', true);
  },
};

/**
 * The switch of the extension being saved is busy but keeps the focus (it stays enabled) and ignores clicks; the
 * others stay usable (review).
 */
export const Busy: Story = {
  args: { canManage: true, busy: 'nat' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const nat = canvas.getByRole('switch', { name: name('nat') });
    await expect(nat).toBeEnabled();
    await expect(nat).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(nat);
    await expect(nat).toHaveFocus();
    await expect(args.onToggle).not.toHaveBeenCalled();
    await expect(canvas.getByRole('switch', { name: name('reverse-proxy') })).toBeEnabled();
  },
};

/** A switch is described by its extension's description, and by why it failed when it did (review). */
export const SwitchDescription: Story = {
  args: {
    canManage: true,
    extensions: EXTENSIONS.map((extension) => (extension.id === 'nat' ? { ...extension, state: 'failed' as const } : extension)),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Accessible descriptions keep French non-breaking spaces: compared as translated.
    await expect(canvas.getByRole('switch', { name: name('reverse-proxy') }))
      .toHaveAccessibleDescription(t('extensions.reverse-proxy.description'));
    await expect(canvas.getByRole('switch', { name: name('nat') }))
      .toHaveAccessibleDescription(`${t('extensions.nat.description')} ${t('workspaceExtensions.failedHint')}`);
  },
};

/** A failed extension says so in words, and its switch still stores the choice (31). */
export const Failed: Story = {
  args: {
    canManage: true,
    extensions: EXTENSIONS.map((extension) => (extension.id === 'nat' ? { ...extension, state: 'failed' as const } : extension)),
  },
  play: async ({ canvasElement }) => {
    await expect(item(canvasElement, 'nat').getByText(t('workspaceExtensions.failed'))).toBeVisible();
    // toHaveTextContent normalizes the page's whitespace, French non-breaking spaces included, not the expected text.
    await expect(within(canvasElement).getByRole('heading', { name: name('nat') }).closest('li'))
      .toHaveTextContent(t('workspaceExtensions.failedHint').replace(/\s+/g, ' '));
    await expect(item(canvasElement, 'nat').getByRole('switch', { name: name('nat') })).toBeEnabled();
    await expect(item(canvasElement, 'reverse-proxy').queryByText(t('workspaceExtensions.failed'))).toBeNull();
  },
};

/** While the list loads, it lists nothing and says so in words, in the page's language; no empty alerts (review). */
export const Loading: Story = {
  args: { extensions: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryAllByRole('listitem')).toEqual([]);
    await expect(canvas.queryAllByRole('alert')).toEqual([]);
    await expect(canvas.getByText(t('workspaceExtensions.loading'))).toBeInTheDocument();
  },
};

/** When the list cannot be loaded, it says so and offers to try again (33). */
export const LoadFailed: Story = {
  args: { extensions: null, failed: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(t('workspaceExtensions.loadFailed'))).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: t('workspaceExtensions.retry') }));
    await expect(args.onRetry).toHaveBeenCalled();
  },
};
