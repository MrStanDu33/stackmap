import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ref } from 'vue';

import UserPasswordModal from './UserPasswordModal.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Molecules/UserPasswordModal',
  component: UserPasswordModal,
  args: { open: true, name: 'Grace', busy: false, done: false, error: null, onSubmit: fn(), 'onUpdate:open': fn() },
} satisfies Meta<typeof UserPasswordModal>;

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
const password = (element: HTMLElement) => within(element).getByLabelText(new RegExp(`^${t('users.temporaryPassword')}`));

/** A dialog named for the account, its password field focused; saving sends the password (19). */
export const Default: Story = {
  play: async ({ args }) => {
    const element = await dialog();
    const field = password(element);

    await expect(element).toHaveAccessibleName(t('users.newPasswordFor', { name: 'Grace' }));
    await expect(element).toHaveAccessibleDescription(t('users.passwordRule'));
    await waitFor(() => expect(field).toHaveFocus());
    await expect(field).toHaveAttribute('autocomplete', 'new-password');
    await userEvent.type(field, 'brand new horse battery');
    await userEvent.click(within(element).getByRole('button', { name: t('users.setPassword') }));

    await expect(args.onSubmit).toHaveBeenCalledWith('brand new horse battery');
  },
};

/** A short password is said on the field; nothing is sent. */
export const FieldError: Story = {
  play: async ({ args }) => {
    const element = await dialog();
    await userEvent.type(password(element), 'short');
    await userEvent.click(within(element).getByRole('button', { name: t('users.setPassword') }));

    await expect(password(element)).toHaveAttribute('aria-invalid', 'true');
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/** Saving: a second press sends nothing more. */
export const Saving: Story = {
  args: { busy: true },
  play: async ({ args }) => {
    const element = await dialog();
    await userEvent.type(password(element), 'brand new horse battery');
    await userEvent.click(within(element).getByRole('button', { name: t('users.setPassword') }));

    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/** Done: says the account was signed out everywhere, and the focus moves from the gone button to Close (19). */
export const Done: Story = {
  render: (args) => ({
    components: { UserPasswordModal },
    setup: () => {
      const done = ref(false);
      return { args, done };
    },
    template: '<UserPasswordModal v-bind="args" :done="done" @submit="done = true" />',
  }),
  play: async () => {
    const element = await dialog();
    await userEvent.type(password(element), 'brand new horse battery');
    await userEvent.click(within(element).getByRole('button', { name: t('users.setPassword') }));

    await expect(within(element).getByRole('status')).toHaveTextContent(t('users.passwordSet', { name: 'Grace' }));
    await waitFor(() => expect(within(element).getByRole('button', { name: t('users.close') })).toHaveFocus());
  },
};

/** Failed: the dialog stays open, with an alert that takes the focus; the typed password is kept (review). */
export const Failed: Story = {
  render: (args) => ({
    components: { UserPasswordModal },
    setup: () => {
      const error = ref<'network' | null>(null);
      return { args, error };
    },
    template: '<UserPasswordModal v-bind="args" :error="error" @submit="error = \'network\'" />',
  }),
  play: async () => {
    const element = await dialog();
    await userEvent.type(password(element), 'brand new horse battery');
    await userEvent.click(within(element).getByRole('button', { name: t('users.setPassword') }));

    const alert = await waitFor(() => within(element).getByRole('alert'));
    await expect(alert).toHaveTextContent(t('users.error.change'));
    await waitFor(() => expect(alert).toHaveFocus());
    await expect(password(element)).toHaveValue('brand new horse battery');
  },
};
