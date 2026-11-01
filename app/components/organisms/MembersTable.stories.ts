import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import MembersTable from './MembersTable.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const ADA = { userId: '0199d6a0-0000-7000-8000-000000000101', name: 'Ada', email: 'ada@homelab.example', role: 'owner' as const, joinedAt: '2026-10-31T09:00:00.000Z' };
const GRACE = { userId: '0199d6a0-0000-7000-8000-000000000102', name: 'Grace', email: 'grace@homelab.example', role: 'editor' as const, joinedAt: '2026-11-01T09:00:00.000Z' };
const ALAN = { userId: '0199d6a0-0000-7000-8000-000000000103', name: 'Alan', email: 'alan@homelab.example', role: 'admin' as const, joinedAt: '2026-11-01T10:00:00.000Z' };
const PENDING = { id: '0199d6a0-0000-7000-8000-000000000201', email: 'linus@homelab.example', role: 'viewer' as const, invitedBy: 'Ada', expiresAt: '2026-11-08T09:00:00.000Z' };

const meta = {
  title: 'Organisms/MembersTable',
  component: MembersTable,
  args: {
    members: [ADA, ALAN, GRACE],
    invitations: [PENDING],
    me: ADA.userId,
    myRole: 'owner',
    error: null,
    onChangeRole: fn(),
    onRemove: fn(),
    onRevoke: fn(),
  },
} satisfies Meta<typeof MembersTable>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;
const role = (key: string) => t(`workspace.role.${key}`);

/** Opens the confirmation and answers it; the dialog is rendered outside the canvas. */
const confirm = async (name: string) => {
  const dialog = await waitFor(() => {
    const element = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!element) {
      throw new Error('No dialog.');
    }
    return element;
  });
  await userEvent.click(within(dialog).getByRole('button', { name }));
};

/** An owner: a captioned table, a labelled role select and Remove for every other member, Leave on their own row. */
export const AsOwner: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const table = canvas.getByRole('table', { name: t('members.title') });

    await expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent.trim()))
      .toEqual([t('members.name'), t('members.email'), t('members.role'), t('members.actions')]);
    await expect(canvas.getByRole('combobox', { name: t('members.roleOf', { name: 'Grace' }) })).toBeEnabled();
    await expect(canvas.getByRole('combobox', { name: t('members.roleOf', { name: 'Alan' }) })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: t('members.leave') })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: t('members.remove', { name: 'Ada' }) })).toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: t('members.remove', { name: 'Grace' }) }));
    await confirm(t('members.remove', { name: 'Grace' }));
    await expect(args.onRemove).toHaveBeenCalledWith(GRACE.userId);
  },
};

/** An admin manages editors and viewers only, and offers only those roles (14, 18). */
export const AsAdmin: Story = {
  args: { me: ALAN.userId, myRole: 'admin' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryByRole('combobox', { name: t('members.roleOf', { name: 'Ada' }) })).toBeNull();
    await expect(canvas.queryByRole('button', { name: t('members.remove', { name: 'Ada' }) })).toBeNull();
    const members = within(canvas.getByRole('table', { name: t('members.title') }));
    await expect(members.getByRole('row', { name: /^Ada/ })).toHaveTextContent(role('owner'));

    await userEvent.click(canvas.getByRole('combobox', { name: t('members.roleOf', { name: 'Grace' }) }));
    const options = await waitFor(() => {
      const found = [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent.trim());
      if (found.length === 0) {
        throw new Error('No options.');
      }
      return found;
    });
    await expect(options).toEqual([role('viewer'), role('editor')]);
    // Closed again, as a user would: an open list hides the rest of the page from assistive technologies.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('[role="listbox"]')).toBeNull());
  },
};

/** A viewer reads the table, with Leave on their own row and nothing else to press (18). */
export const AsViewer: Story = {
  args: { me: GRACE.userId, myRole: 'viewer', members: [ADA, { ...GRACE, role: 'viewer' }], invitations: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryAllByRole('combobox')).toEqual([]);
    await expect(canvas.getAllByRole('button').map((button) => button.textContent.trim())).toEqual([t('members.leave')]);
    await expect(canvas.queryByRole('table', { name: t('members.invitations') })).toBeNull();
  },
};

/** Leaving asks first; confirming sends their own id (15). */
export const Leave: Story = {
  args: { me: GRACE.userId, myRole: 'editor' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: t('members.leave') }));
    await confirm(t('members.leave'));

    await expect(args.onRemove).toHaveBeenCalledWith(GRACE.userId);
  },
};

/** Pending invitations, each with its expiry and a Revoke that names the email (13). */
export const Invitations: Story = {
  play: async ({ canvasElement, args }) => {
    const table = within(canvasElement).getByRole('table', { name: t('members.invitations') });

    await expect(table).toHaveTextContent('linus@homelab.example');
    await expect(table).toHaveTextContent(role('viewer'));
    await userEvent.click(within(table).getByRole('button', { name: t('members.revoke', { email: 'linus@homelab.example' }) }));
    await confirm(t('members.revokeConfirm'));
    await expect(args.onRevoke).toHaveBeenCalledWith(PENDING.id);
  },
};

/** A refusal to leave the workspace without an owner, said in an alert (16). */
export const LastOwnerRefused: Story = {
  args: { error: 'last_owner' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(t('members.lastOwner'));
  },
};
