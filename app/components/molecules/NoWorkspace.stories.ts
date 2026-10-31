import { expect, within } from 'storybook/test';

import NoWorkspace from './NoWorkspace.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Molecules/NoWorkspace',
  component: NoWorkspace,
  args: { canCreate: true },
} satisfies Meta<typeof NoWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;

/** The instance administrator can create one, or add the demo (20). */
export const Admin: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(t('traffic.noWorkspace'))).toBeVisible();
    await expect(canvas.getByText(t('traffic.noWorkspaceHint'))).toBeVisible();
    await expect(canvas.getByRole('link', { name: t('workspace.create') })).toHaveAttribute('href', '/workspaces/new');
  },
};

/** Another account is told to ask for an invitation, with no link (20). */
export const Member: Story = {
  args: { canCreate: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(t('traffic.noWorkspace'))).toBeVisible();
    await expect(canvas.getByText(t('traffic.noWorkspaceMember'))).toBeVisible();
    await expect(canvas.queryByRole('link')).toBeNull();
  },
};
