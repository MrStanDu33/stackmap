import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ref } from 'vue';

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
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(t('auth.login.throttled', { seconds: 42 }, 42));
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

/** One second, in the singular. */
export const ThrottledOneSecond: Story = {
  args: { error: 'throttled', retryAfter: 1 },
  play: async ({ canvasElement }) => {
    const alert = within(canvasElement).getByRole('alert');

    await expect(alert).toHaveTextContent(t('auth.login.throttled', { seconds: 1 }, 1));
    // Not "1 seconds" nor "1 secondes".
    await expect(alert.textContent).not.toMatch(/\b1 seconde?s\b/);
  },
};

/** While signing in, the fields are read-only rather than disabled, and the button stays focusable: focus is kept. */
export const Submitting: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const form = fields(canvasElement);

    await expect(form.email).toHaveAttribute('readonly');
    await expect(form.password).toHaveAttribute('readonly');
    await expect(form.submit).not.toBeDisabled();
    await expect(form.submit).toHaveAttribute('aria-busy', 'true');
  },
};

/** A second failure is announced again, and focus goes back to the password to try once more. */
export const RepeatedFailure: Story = {
  render: (args) => ({
    components: { LoginForm },
    setup: () => {
      const error = ref<'invalid' | null>(null);
      // As the page does: the last error goes when a new attempt starts, and comes back when it fails.
      const submit = () => {
        error.value = null;
        setTimeout(() => {
          error.value = 'invalid';
        }, 50);
      };
      return { args, error, submit };
    },
    template: '<LoginForm :error="error" @submit="submit" />',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const form = fields(canvasElement);

    await userEvent.type(form.email, 'ada@homelab.example');
    await userEvent.type(form.password, 'not the password{Enter}');
    const first = await canvas.findByRole('alert');
    await waitFor(() => expect(form.password).toHaveFocus());

    // Tried again from the email field: after the failure, focus goes to the password all the same.
    await userEvent.click(form.email);
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(canvas.getByRole('alert')).not.toBe(first));
    await expect(canvas.getByRole('alert')).toHaveTextContent(t('auth.login.invalid'));
    await waitFor(() => expect(form.password).toHaveFocus());
  },
};
