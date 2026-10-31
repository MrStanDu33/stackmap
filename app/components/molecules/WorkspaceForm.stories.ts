import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import WorkspaceForm from './WorkspaceForm.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Molecules/WorkspaceForm',
  component: WorkspaceForm,
  args: { busy: false, error: null, onSubmit: fn() },
} satisfies Meta<typeof WorkspaceForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;
const fields = (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  return {
    name: canvas.getByRole('textbox', { name: t('workspace.new.name') }),
    slug: canvas.getByRole('textbox', { name: t('workspace.new.slug') }),
    submit: canvas.getByRole('button', { name: t('workspace.new.submit') }),
  };
};

/** Two required, labelled fields; the name fills the slug, whose hint shows the link; submitting sends both (23). */
export const SlugFollowsName: Story = {
  play: async ({ canvasElement, args }) => {
    const form = fields(canvasElement);

    await expect(form.name).toBeRequired();
    await expect(form.slug).toBeRequired();
    await userEvent.type(form.name, 'Réseau d’été');
    await expect(form.slug).toHaveValue('reseau-d-ete');
    await expect(form.slug).toHaveAccessibleDescription(t('workspace.new.slugHint', { slug: 'reseau-d-ete' }));

    await userEvent.click(form.submit);
    await expect(args.onSubmit).toHaveBeenCalledWith({ name: 'Réseau d’été', slug: 'reseau-d-ete' });
  },
};

/** Once the slug is edited, the name no longer changes it (23). */
export const SlugEditedStaysPut: Story = {
  play: async ({ canvasElement }) => {
    const form = fields(canvasElement);

    await userEvent.type(form.name, 'Home');
    await userEvent.clear(form.slug);
    await userEvent.type(form.slug, 'house');
    await userEvent.type(form.name, 'lab');

    await expect(form.slug).toHaveValue('house');
  },
};

/** Empty fields: each says what is wrong, focus on the first, nothing sent (24). */
export const Invalid: Story = {
  play: async ({ canvasElement, args }) => {
    const form = fields(canvasElement);

    await userEvent.click(form.submit);

    await waitFor(() => expect(form.name).toHaveFocus());
    await expect(form.name).toHaveAccessibleDescription(expect.stringContaining(t('workspace.error.name')) as string);
    await expect(form.slug).toHaveAccessibleDescription(expect.stringContaining(t('workspace.error.slug')) as string);
    await expect(form.name).toHaveAttribute('aria-invalid', 'true');
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/** A taken slug: the error is on the slug field, which gets focus (24). */
export const SlugTaken: Story = {
  args: { error: 'taken' },
  play: async ({ canvasElement }) => {
    const form = fields(canvasElement);

    await waitFor(() => expect(form.slug).toHaveFocus());
    await expect(form.slug).toHaveAccessibleDescription(expect.stringContaining(t('workspace.error.slugTaken')) as string);
    await expect(form.slug).toHaveAttribute('aria-invalid', 'true');
  },
};

/** Sending: read-only fields, the button busy, focus kept. */
export const Submitting: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const form = fields(canvasElement);

    await expect(form.name).toHaveAttribute('readonly');
    await expect(form.slug).toHaveAttribute('readonly');
    await expect(form.submit).toHaveAttribute('aria-busy', 'true');
  },
};

/** Stackmap could not be reached: an alert, and sending again retries. */
export const NetworkError: Story = {
  args: { error: 'network' },
  play: async ({ canvasElement, args }) => {
    const form = fields(canvasElement);

    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(t('auth.error.network'));
    await userEvent.type(form.name, 'Home');
    await userEvent.click(form.submit);
    await expect(args.onSubmit).toHaveBeenCalledOnce();
  },
};
