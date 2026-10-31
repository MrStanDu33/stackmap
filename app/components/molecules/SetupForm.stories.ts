import { expect, fn, userEvent, within } from 'storybook/test';

import SetupForm from './SetupForm.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Molecules/SetupForm',
  component: SetupForm,
  args: { busy: false, onSubmit: fn() },
} satisfies Meta<typeof SetupForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;
const fields = (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  return {
    name: canvas.getByRole('textbox', { name: t('auth.field.name') }),
    email: canvas.getByRole('textbox', { name: t('auth.field.email') }),
    password: canvas.getByLabelText(t('auth.field.password'), { selector: 'input' }),
    demo: canvas.getByRole('checkbox', { name: t('auth.setup.demo') }),
    submit: canvas.getByRole('button', { name: t('auth.setup.submit') }),
  };
};

/**
 * Labelled name, email and password fields with autocomplete, the 12-character hint visible, "Add the demo workspace"
 * checked; submitting sends them.
 */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const form = fields(canvasElement);

    await expect(form.name).toHaveAttribute('autocomplete', 'name');
    await expect(form.email).toHaveAttribute('autocomplete', 'email');
    await expect(form.password).toHaveAttribute('autocomplete', 'new-password');
    await expect(form.password).toHaveAccessibleDescription(expect.stringContaining(t('auth.field.passwordHint')) as unknown);
    await expect(form.demo).toBeChecked();

    await userEvent.type(form.name, 'Ada');
    await userEvent.type(form.email, 'ada@homelab.example');
    await userEvent.type(form.password, 'correct horse battery');
    await userEvent.click(form.submit);

    await expect(args.onSubmit).toHaveBeenCalledWith({
      name: 'Ada', email: 'ada@homelab.example', password: 'correct horse battery', demo: true,
    });
  },
};

/** Each error next to its field and linked to it, focus on the first, the errors announced (7). */
export const Invalid: Story = {
  play: async ({ canvasElement, args }) => {
    const form = fields(canvasElement);

    await userEvent.type(form.email, 'ada');
    await userEvent.type(form.password, 'short');
    await userEvent.click(form.submit);

    await expect(form.name).toHaveFocus();
    await expect(form.name).toHaveAccessibleDescription(expect.stringContaining(t('auth.error.name')) as unknown);
    await expect(form.email).toHaveAccessibleDescription(expect.stringContaining(t('auth.error.email', { example: 'admin@homelab.example' })) as unknown);
    await expect(form.password).toHaveAccessibleDescription(expect.stringContaining(t('auth.error.password')) as unknown);
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(t('auth.error.name'));
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/** The show/hide toggle has a stable name and aria-pressed, and switches the field type. */
export const ShowPassword: Story = {
  play: async ({ canvasElement }) => {
    const { password } = fields(canvasElement);
    const toggle = within(canvasElement).getByRole('button', { name: t('auth.field.showPassword') });

    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(password).toHaveAttribute('type', 'password');
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(password).toHaveAttribute('type', 'text');
  },
};

/** While submitting, the button is busy and keeps its name, and the form is disabled. */
export const Submitting: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const form = fields(canvasElement);

    await expect(form.submit).toHaveAttribute('aria-busy', 'true');
    await expect(form.name).toBeDisabled();
    await expect(form.password).toBeDisabled();
  },
};
