import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import UsersTable from './UsersTable.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const ADA = { id: '0199d6a0-0000-7000-8000-000000000101', name: 'Ada', email: 'ada@homelab.example', role: 'admin' as const, createdAt: '2026-10-31T09:00:00.000Z' };
const GRACE = { id: '0199d6a0-0000-7000-8000-000000000102', name: 'Grace', email: 'grace@homelab.example', role: 'user' as const, createdAt: '2026-11-01T09:00:00.000Z' };
const ALAN = { id: '0199d6a0-0000-7000-8000-000000000103', name: 'Alan', email: 'alan@homelab.example', role: 'admin' as const, createdAt: '2026-11-02T09:00:00.000Z' };

const meta = {
  title: 'Organisms/UsersTable',
  component: UsersTable,
  args: {
    users: [ADA, ALAN, GRACE],
    me: ADA.id,
    error: null,
    onChangeRole: fn(),
    onRemove: fn(),
    onResetPassword: fn(),
  },
} satisfies Meta<typeof UsersTable>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;

const dialog = () => waitFor(() => {
  const element = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!element) {
    throw new Error('No dialog.');
  }
  return element;
});

/** A captioned table; every other row has a named role select, New temporary password and Remove (17). */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = canvas.getByRole('table', { name: t('users.accounts') });

    await expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent.trim()))
      .toEqual([t('users.name'), t('users.email'), t('users.role'), t('users.created'), t('users.actions')]);
    for (const name of ['Grace', 'Alan']) {
      await expect(canvas.getByRole('combobox', { name: t('users.roleOf', { name }) })).toBeEnabled();
      await expect(canvas.getByRole('button', { name: t('users.newPasswordFor', { name }) })).toBeVisible();
      await expect(canvas.getByRole('button', { name: t('users.remove', { name }) })).toBeVisible();
    }
  },
};

/** Their own row says You in words and has no actions (17). */
export const OwnRow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByRole('row', { name: /^Ada/ });

    await expect(row).toHaveTextContent(t('users.you'));
    await expect(row).toHaveTextContent(t('users.roleLabel.admin'));
    await expect(within(row).queryAllByRole('button')).toEqual([]);
    await expect(within(row).queryAllByRole('combobox')).toEqual([]);
  },
};

/** Only the administrator: the table, and a hint to create an account. */
export const OnlyYou: Story = {
  args: { users: [ADA] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(t('users.onlyYou'))).toBeVisible();
  },
};

/** Choosing a role sends it, with the account's id (8). */
export const ChangeRole: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('combobox', { name: t('users.roleOf', { name: 'Grace' }) }));
    const option = await waitFor(() => {
      const found = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
        .find((element) => element.textContent.trim() === t('users.roleLabel.admin'));
      if (!found) {
        throw new Error('No option.');
      }
      return found;
    });
    await userEvent.click(option);

    await expect(args.onChangeRole).toHaveBeenCalledWith(GRACE.id, 'admin');
    // Closed for good before the accessibility check: an open list hides the rest of the page.
    await waitFor(() => expect(document.querySelector('[role="listbox"]')).toBeNull());
    await waitFor(() => expect(document.querySelector('[data-aria-hidden]')).toBeNull());
  },
};

/** Remove asks first, naming the account and what goes with it; confirming sends its id (18). */
export const Remove: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: t('users.remove', { name: 'Grace' }) }));
    const confirm = await dialog();

    // Spaces normalised, as toHaveTextContent does to the text it reads (French has non-breaking ones).
    await expect(confirm).toHaveTextContent(t('users.removeQuestion', { name: 'Grace' }).replace(/\s+/g, ' '));
    await userEvent.click(within(confirm).getByRole('button', { name: t('users.remove', { name: 'Grace' }) }));
    await expect(args.onRemove).toHaveBeenCalledWith(GRACE.id);
  },
};

/** Cancelling a removal sends nothing and gives the focus back to Remove (18). */
export const RemoveCancelled: Story = {
  play: async ({ canvasElement, args }) => {
    const remove = within(canvasElement).getByRole('button', { name: t('users.remove', { name: 'Grace' }) });
    await userEvent.click(remove);
    const confirm = await dialog();
    // Once the dialog has the focus, as a user who reads it before answering.
    await waitFor(() => expect(confirm.contains(document.activeElement)).toBe(true));
    await userEvent.click(within(confirm).getByRole('button', { name: t('users.cancel') }));

    await waitFor(() => expect(remove).toHaveFocus());
    await expect(args.onRemove).not.toHaveBeenCalled();
  },
};

/** New temporary password asks for the account it is for (19). */
export const NewPassword: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: t('users.newPasswordFor', { name: 'Grace' }) }));

    await expect(args.onResetPassword).toHaveBeenCalledWith(GRACE.id);
  },
};

/** The last administrator's refusal, in an alert that takes the focus; the select shows the stored role (20). */
export const LastAdminRefused: Story = {
  args: { error: { code: 'last_admin' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');

    await expect(alert).toHaveTextContent(t('users.lastAdmin'));
    await waitFor(() => expect(alert).toHaveFocus());
    await expect(canvas.getByRole('combobox', { name: t('users.roleOf', { name: 'Alan' }) }))
      .toHaveTextContent(t('users.roleLabel.admin'));
  },
};

/** A removal refused for a sole owner names the workspaces, as a list in words (20). */
export const LastOwnerRefused: Story = {
  args: { error: { code: 'last_owner', name: 'Grace', workspaces: ['Home lab', 'Office'] } },
  play: async ({ canvasElement }) => {
    const alert = within(canvasElement).getByRole('alert');
    const workspaces = new Intl.ListFormat(i18n.global.locale.value, { type: 'conjunction' }).format(['Home lab', 'Office']);

    await expect(alert).toHaveTextContent(t('users.lastOwner', { name: 'Grace', workspaces }));
    await waitFor(() => expect(alert).toHaveFocus());
  },
};
