import { expect, fn, spyOn, userEvent, waitFor, within } from 'storybook/test';

import InviteForm from './InviteForm.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const LINK = 'http://localhost:3000/invite/Zm9yIHRoZSBleGFtcGxlIG9ubHkgbm90IGEgdG9rZW4x';

const meta = {
  title: 'Molecules/InviteForm',
  component: InviteForm,
  args: { roles: ['viewer', 'editor', 'admin', 'owner'], busy: false, error: null, created: null, onSubmit: fn() },
} satisfies Meta<typeof InviteForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;
const fields = (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  return {
    email: canvas.getByRole('textbox', { name: new RegExp(`^${t('invite.email')}`) }),
    role: canvas.getByRole('combobox', { name: new RegExp(`^${t('invite.role')}`) }),
    submit: canvas.getByRole('button', { name: t('invite.submit') }),
  };
};

/** An email and a role, viewer by default; submitting sends them (1). */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const form = fields(canvasElement);

    await expect(form.role).toHaveTextContent(t('workspace.role.viewer'));
    await userEvent.type(form.email, 'alan@homelab.example');
    await userEvent.click(form.submit);
    await expect(args.onSubmit).toHaveBeenCalledWith({ email: 'alan@homelab.example', role: 'viewer' });
  },
};

/** An invalid email is said on its field, which gets focus; nothing is sent. */
export const InvalidEmail: Story = {
  play: async ({ canvasElement, args }) => {
    const form = fields(canvasElement);

    await userEvent.type(form.email, 'alan');
    await userEvent.click(form.submit);

    await waitFor(() => expect(form.email).toHaveFocus());
    await expect(form.email).toHaveAttribute('aria-invalid', 'true');
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/** Someone already a member: said on the email field (3). */
export const AlreadyMember: Story = {
  args: { error: 'already_member' },
  play: async ({ canvasElement }) => {
    const form = fields(canvasElement);

    await waitFor(() => expect(form.email).toHaveFocus());
    await expect(form.email).toHaveAccessibleDescription(expect.stringContaining(t('invite.error.alreadyMember')) as string);
  },
};

/** The link, shown once: a labelled read-only field, focused, with Copy, which says it copied (19). */
export const Created: Story = {
  args: { created: { url: LINK, email: 'alan@homelab.example' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('textbox', { name: t('invite.link') });

    await waitFor(() => expect(link).toHaveFocus());
    await expect(link).toHaveValue(LINK);
    await expect(link).toHaveAttribute('readonly');
    await expect(link).toHaveAccessibleDescription(t('invite.linkHint', { email: 'alan@homelab.example' }));
    await expect(canvas.getByRole('status')).toHaveTextContent(t('invite.created', { email: 'alan@homelab.example' }));

    // The test browser has no clipboard permission: the copy itself is what is checked.
    const writeText = spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await userEvent.click(canvas.getByRole('button', { name: t('invite.copy') }));
    await expect(writeText).toHaveBeenCalledWith(LINK);
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent(t('invite.copied')));
    writeText.mockRestore();
  },
};

/** An admin may grant only editor and viewer (2). */
export const AdminRoles: Story = {
  args: { roles: ['viewer', 'editor'] },
  play: async ({ canvasElement }) => {
    await userEvent.click(fields(canvasElement).role);
    const options = await waitFor(() => {
      const found = [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent.trim());
      if (found.length === 0) {
        throw new Error('No options.');
      }
      return found;
    });
    await expect(options).toEqual([t('workspace.role.viewer'), t('workspace.role.editor')]);
    // Closed again, as a user would: an open list hides the rest of the page from assistive technologies.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('[role="listbox"]')).toBeNull());
  },
};

/** Sending: read-only, busy. */
export const Sending: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const form = fields(canvasElement);

    await expect(form.email).toHaveAttribute('readonly');
    await expect(form.submit).toHaveAttribute('aria-busy', 'true');
  },
};
