import { expect, fn, userEvent, within } from 'storybook/test';

import LoginForm from './LoginForm.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Molecules/LoginForm',
  component: LoginForm,
  args: { busy: false, error: null, retryAfter: null, onSubmit: fn() },
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;
const fields = (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  return {
    email: canvas.getByRole('textbox', { name: t('auth.field.email') }),
    password: canvas.getByLabelText(t('auth.field.password'), { selector: 'input' }),
    submit: canvas.getByRole('button', { name: t('auth.login.submit') }),
  };
};

/** Labelled email and password fields with autocomplete; submitting sends them. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const form = fields(canvasElement);

    await expect(form.email).toHaveAttribute('autocomplete', 'username');
    await expect(form.password).toHaveAttribute('autocomplete', 'current-password');
    await expect(within(canvasElement).queryByRole('alert')).toBeNull();

    await userEvent.type(form.email, 'ada@homelab.example');
    await userEvent.type(form.password, 'correct horse battery{Enter}');

    await expect(args.onSubmit).toHaveBeenCalledWith({ email: 'ada@homelab.example', password: 'correct horse battery' });
  },
};

/** "Email or password is incorrect." in an alert, saying neither which (10). */
export const InvalidCredentials: Story = {
  args: { error: 'invalid' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(t('auth.login.invalid'));
  },
};

/** The alert says how many seconds to wait (11). */
export const Throttled: Story = {
  args: { error: 'throttled', retryAfter: 42 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(t('auth.login.throttled', { seconds: 42 }));
  },
};

/** The alert says Stackmap could not be reached, and submitting again retries. */
export const NetworkError: Story = {
  args: { error: 'network' },
  play: async ({ canvasElement, args }) => {
    const form = fields(canvasElement);

    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(t('auth.error.network'));
    await userEvent.type(form.email, 'ada@homelab.example');
    await userEvent.type(form.password, 'correct horse battery');
    await userEvent.click(form.submit);
    await expect(args.onSubmit).toHaveBeenCalledOnce();
  },
};
