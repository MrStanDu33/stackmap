import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import PasswordForm from './PasswordForm.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Molecules/PasswordForm',
  component: PasswordForm,
  args: { busy: false, error: null, retryAfter: null, done: false, onSubmit: fn() },
} satisfies Meta<typeof PasswordForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;
const fields = (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  return {
    current: canvas.getByLabelText(new RegExp(`^${t('settings.currentPassword')}`)),
    next: canvas.getByLabelText(new RegExp(`^${t('settings.newPassword')}`)),
    confirm: canvas.getByLabelText(new RegExp(`^${t('settings.confirmPassword')}`)),
    submit: canvas.getByRole('button', { name: t('settings.changePassword') }),
  };
};
const fill = async (canvasElement: HTMLElement, current: string, next: string, confirm = next) => {
  const form = fields(canvasElement);
  await userEvent.type(form.current, current);
  await userEvent.type(form.next, next);
  await userEvent.type(form.confirm, confirm);
  await userEvent.click(form.submit);
  return form;
};

/** Current, new and confirmation, labelled for password managers; sending gives the current and the new (7, 10). */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const form = fields(canvasElement);
    await expect(form.current).toHaveAttribute('autocomplete', 'current-password');
    await expect(form.next).toHaveAttribute('autocomplete', 'new-password');
    await expect(form.confirm).toHaveAttribute('autocomplete', 'new-password');
    await expect(form.next).toHaveAccessibleDescription(t('settings.passwordRule'));

    await fill(canvasElement, 'correct horse battery', 'brand new horse battery');

    await expect(args.onSubmit).toHaveBeenCalledWith({ currentPassword: 'correct horse battery', newPassword: 'brand new horse battery' });
  },
};

/** A confirmation that differs is said on its field, which takes the focus; nothing is sent (10). */
export const ConfirmationDiffers: Story = {
  play: async ({ canvasElement, args }) => {
    const form = await fill(canvasElement, 'correct horse battery', 'brand new horse battery', 'brand new horse batteyr');

    await waitFor(() => expect(form.confirm).toHaveFocus());
    await expect(form.confirm).toHaveAccessibleDescription(t('settings.error.confirmation'));
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/** A new password under 12 characters is said on its field (9). */
export const TooShort: Story = {
  play: async ({ canvasElement, args }) => {
    const form = await fill(canvasElement, 'correct horse battery', 'short');

    await waitFor(() => expect(form.next).toHaveFocus());
    await expect(form.next).toHaveAttribute('aria-invalid', 'true');
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/** A new password equal to the current one is said on the new field before sending (9). */
export const SamePassword: Story = {
  play: async ({ canvasElement, args }) => {
    const form = await fill(canvasElement, 'correct horse battery', 'correct horse battery');

    await waitFor(() => expect(form.next).toHaveFocus());
    await expect(form.next).toHaveAccessibleDescription(new RegExp(t('settings.error.same')));
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/** A wrong current password, from the server, is said on its field, which takes the focus (8). */
export const WrongCurrent: Story = {
  args: { error: 'wrong_password' },
  play: async ({ canvasElement }) => {
    const form = fields(canvasElement);

    await waitFor(() => expect(form.current).toHaveFocus());
    await expect(form.current).toHaveAccessibleDescription(t('settings.error.wrongPassword'));
  },
};

/** Too many attempts: an alert says how long to wait (8). */
export const Throttled: Story = {
  args: { error: 'throttled', retryAfter: 42 },
  play: async ({ canvasElement }) => {
    const alert = within(canvasElement).getByRole('alert');

    await expect(alert).toHaveTextContent(t('auth.login.throttled', { seconds: 42 }, 42));
    await waitFor(() => expect(alert).toHaveFocus());
  },
};

/** Sending: a second press sends nothing more. */
export const Sending: Story = {
  args: { busy: true },
  play: async ({ canvasElement, args }) => {
    await fill(canvasElement, 'correct horse battery', 'brand new horse battery');

    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/** Changed: a status says so, other sessions included, and the fields are empty (7, 10). */
export const Changed: Story = {
  args: { done: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(t('settings.passwordChanged'));
    await expect(fields(canvasElement).current).toHaveValue('');
  },
};
