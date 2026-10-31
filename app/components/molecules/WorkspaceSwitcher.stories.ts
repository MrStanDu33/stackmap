import { expect, userEvent, waitFor, within } from 'storybook/test';

import WorkspaceSwitcher from './WorkspaceSwitcher.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const WORKSPACES = [
  { name: 'Demo', slug: 'demo', role: 'owner' as const },
  { name: 'Homelab', slug: 'homelab', role: 'viewer' as const },
];

const meta = {
  title: 'Molecules/WorkspaceSwitcher',
  component: WorkspaceSwitcher,
  args: { workspaces: WORKSPACES, current: 'demo', view: 'graph', canCreate: false, collapsed: false },
} satisfies Meta<typeof WorkspaceSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;
const role = (key: 'owner' | 'viewer') => t(`workspace.role.${key}`);

/** Opens the menu from its button; the menu is rendered in a portal, outside the canvas. */
const open = async (canvasElement: HTMLElement, name: string) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name }));
  return within(await waitFor(() => {
    const menu = document.querySelector<HTMLElement>('[role="menu"]');
    if (!menu) {
      throw new Error('The menu is not open.');
    }
    return menu;
  }));
};

/** "Workspace: Demo"; the menu lists each workspace and role, as links to the same view, the current one said (22). */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const menu = await open(canvasElement, t('workspace.switcher', { name: 'Demo' }));

    const items = menu.getAllByRole('menuitem');
    await expect(items).toHaveLength(2);
    await expect(items[0]).toHaveTextContent(t('workspace.withRole', { name: 'Demo', role: role('owner') }));
    await expect(items[0]).toHaveTextContent(t('workspace.current'));
    await expect(items[0]).toHaveAttribute('aria-current', 'page');
    await expect(items[1]).toHaveTextContent(t('workspace.withRole', { name: 'Homelab', role: role('viewer') }));
    await expect(items[1]).toHaveAttribute('href', '/w/homelab/graph');
    await expect(menu.queryByRole('menuitem', { name: t('workspace.create') })).toBeNull();

    await userEvent.keyboard('{Escape}');
    const button = within(canvasElement).getByRole('button', { name: t('workspace.switcher', { name: 'Demo' }) });
    await waitFor(() => expect(button).toHaveFocus());
  },
};

/** In the Trace view, the links keep it (22). */
export const KeepsTheView: Story = {
  args: { view: 'trace' },
  play: async ({ canvasElement }) => {
    const menu = await open(canvasElement, t('workspace.switcher', { name: 'Demo' }));

    await expect(menu.getAllByRole('menuitem')[1]).toHaveAttribute('href', '/w/homelab/trace');
  },
};

/** The instance administrator also gets "Create a workspace" (22). */
export const AdminCanCreate: Story = {
  args: { canCreate: true },
  play: async ({ canvasElement }) => {
    const menu = await open(canvasElement, t('workspace.switcher', { name: 'Demo' }));

    await expect(menu.getByRole('menuitem', { name: t('workspace.create') })).toHaveAttribute('href', '/workspaces/new');
  },
};

/** While the list loads: "Workspace", busy. */
export const Loading: Story = {
  args: { workspaces: null, current: 'demo' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: t('workspace.switcherLoading') }))
      .toHaveAttribute('aria-busy', 'true');
  },
};

/** Collapsed: an icon button, still named "Workspace: Demo". */
export const Collapsed: Story = {
  args: { collapsed: true },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: t('workspace.switcher', { name: 'Demo' }) });

    await expect(button).not.toHaveTextContent('Demo');
  },
};
