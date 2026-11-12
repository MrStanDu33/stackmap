import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import CreateUserForm from './CreateUserForm.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Molecules/CreateUserForm',
  component: CreateUserForm,
  args: { busy: false, error: null, created: null, onSubmit: fn() },
} satisfies Meta<typeof CreateUserForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;
const fields = (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  return {
    name: canvas.getByRole('textbox', { name: new RegExp(`^${t('users.name')}`) }),
    email: canvas.getByRole('textbox', { name: new RegExp(`^${t('users.email')}`) }),
    password: canvas.getByLabelText(new RegExp(`^${t('users.temporaryPassword')}`)),
    submit: canvas.getByRole('button', { name: t('users.create') }),
  };
};

/** A name, an email and a temporary password a password manager will not fill with the admin's own (2). */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const form = fields(canvasElement);
    await expect(within(canvasElement).getByRole('heading', { name: t('users.createTitle') })).toBeVisible();
    await expect(form.password).toHaveAttribute('autocomplete', 'new-password');
    await expect(form.password).toHaveAccessibleDescription(t('users.passwordRule'));

    await userEvent.type(form.name, 'Grace');
    await userEvent.type(form.email, 'grace@homelab.example');
    await userEvent.type(form.password, 'temporary horse battery');
    await userEvent.click(form.submit);

    await expect(args.onSubmit).toHaveBeenCalledWith({
      name: 'Grace', email: 'grace@homelab.example', password: 'temporary horse battery',
    });
  },
};

/** An invalid email or a short password is said on its field, which takes the focus; nothing is sent (4). */
export const FieldErrors: Story = {
  play: async ({ canvasElement, args }) => {
    const form = fields(canvasElement);
    await userEvent.type(form.name, 'Grace');
    await userEvent.type(form.email, 'grace');
    await userEvent.type(form.password, 'short');
    await userEvent.click(form.submit);

    await waitFor(() => expect(form.email).toHaveFocus());
    await expect(form.email).toHaveAttribute('aria-invalid', 'true');
    await expect(form.password).toHaveAttribute('aria-invalid', 'true');
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/** Sending: a second press sends nothing more. */
export const Sending: Story = {
  args: { busy: true },
  play: async ({ canvasElement, args }) => {
    const form = fields(canvasElement);

    await userEvent.click(form.submit);
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/** A taken email is said on the email field, which takes the focus (3). */
export const EmailTaken: Story = {
  args: { error: 'email_taken' },
  play: async ({ canvasElement }) => {
    const form = fields(canvasElement);

    await waitFor(() => expect(form.email).toHaveFocus());
    await expect(form.email).toHaveAccessibleDescription(t('users.error.emailTaken'));
  },
};

/** Created: a status says to send the password privately, and the fields are empty again (17). */
export const Created: Story = {
  args: { created: { email: 'grace@homelab.example' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('status')).toHaveTextContent(t('users.created', { email: 'grace@homelab.example' }));
    await expect(fields(canvasElement).email).toHaveValue('');
  },
};
