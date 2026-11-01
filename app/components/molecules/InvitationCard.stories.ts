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
    onRegister: fn(),
    onAccept: fn(),
    onSignOut: fn(),
  },
} satisfies Meta<typeof InvitationCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const { t } = i18n.global;
const offer = () => t('invitation.offer', { inviter: 'Ada', workspace: 'Demo', role: t('workspace.role.editor') });

/** Signed out: what the invitation offers, the registration form with the email fixed, and Sign in to accept (12). */
export const SignedOut: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(offer())).toBeVisible();
    await expect(canvas.getByRole('link', { name: t('invitation.signIn') })).toHaveAttribute('href', '/login?redirect=/invite/token');
    const email = canvas.getByRole('textbox', { name: new RegExp(`^${t('auth.field.email')}`) });
    await expect(email).toHaveValue('alan@homelab.example');
    await expect(email).toHaveAttribute('readonly');

    await userEvent.type(canvas.getByRole('textbox', { name: new RegExp(`^${t('auth.field.name')}`) }), 'Alan');
    await userEvent.type(canvas.getByLabelText(new RegExp(`^${t('auth.field.password')}`), { selector: 'input' }), 'correct horse battery');
    await userEvent.click(canvas.getByRole('button', { name: t('invitation.register') }));
    await expect(args.onRegister).toHaveBeenCalledWith({ name: 'Alan', password: 'correct horse battery' });
  },
};

/** After registering: whatever happened, the same next step, without saying whether the account existed (8, 9). */
export const Registered: Story = {
  args: { state: 'registered' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent(t('invitation.registered', { email: 'alan@homelab.example' })));
    await expect(canvas.getByRole('link', { name: t('invitation.signIn') })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: t('invitation.register') })).toBeNull();
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

/** An unknown, expired or used link (7). */
export const NotFound: Story = {
  args: { invitation: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('heading', { name: t('invitation.notFound') })).toBeVisible();
    await expect(canvas.getByText(t('invitation.notFoundHint'))).toBeVisible();
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};
