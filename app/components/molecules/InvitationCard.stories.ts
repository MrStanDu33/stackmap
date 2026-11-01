import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import InvitationCard from './InvitationCard.vue';
import { i18n } from '../../../.storybook/nuxt-shims';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const INVITATION = {
  workspace: 'Demo', role: 'editor' as const, email: 'alan@homelab.example', invitedBy: 'Ada',
  expiresAt: '2026-11-08T09:00:00.000Z',
};

const meta = {
  title: 'Molecules/InvitationCard',
  component: InvitationCard,
  args: {
    invitation: INVITATION,
    state: 'signedOut',
    signedInAs: null,
    signInTo: '/login?redirect=/invite/token',
    busy: false,
    error: null,
    onAccept: fn(),
    onSignOut: fn(),
  },
} satisfies Meta<typeof InvitationCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;
const offer = () => t('invitation.offer', { inviter: 'Ada', workspace: 'Demo', role: t('workspace.role.editor') });

/** Signed out: what it offers, and Sign in to accept with the invited account; no way to create one here (12). */
export const SignedOut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(offer())).toBeVisible();
    // Matched as the page shows it: Testing Library reads a non-breaking space (French punctuation) as a space.
    await expect(canvas.getByText(t('invitation.signInHint', { email: 'alan@homelab.example' }).replace(/\s+/g, ' '))).toBeVisible();
    await expect(canvas.getByRole('link', { name: t('invitation.signIn') })).toHaveAttribute('href', '/login?redirect=/invite/token');
    await expect(canvas.queryAllByRole('textbox')).toEqual([]);
  },
};

/** Signed in with the invited email: Accept (10, 12). */
export const Accept: Story = {
  args: { state: 'accept', signedInAs: 'alan@homelab.example' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: t('invitation.accept') }));

    await expect(args.onAccept).toHaveBeenCalledOnce();
  },
};

/** Signed in as someone else: whom it is for, and Sign out (12). */
export const WrongAccount: Story = {
  args: { state: 'wrongAccount', signedInAs: 'grace@homelab.example' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(t('invitation.wrongAccount', { email: 'grace@homelab.example', invited: 'alan@homelab.example' }))).toBeVisible();
    await expect(canvas.queryByRole('button', { name: t('invitation.accept') })).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: t('invitation.signOut') }));
    await expect(args.onSignOut).toHaveBeenCalledOnce();
  },
};

/** A failure, said in an alert that takes the focus. */
export const AcceptFailed: Story = {
  args: { state: 'accept', signedInAs: 'alan@homelab.example', error: 'invitation.error' },
  play: async ({ canvasElement }) => {
    const alert = within(canvasElement).getByRole('alert');

    await expect(alert).toHaveTextContent(t('invitation.error'));
    await waitFor(() => expect(alert).toHaveFocus());
  },
};

/** An unknown, expired or used link: why, with nothing to press. The page's heading says it is not found (7). */
export const NotFound: Story = {
  args: { invitation: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(t('invitation.notFoundHint'))).toBeVisible();
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};
