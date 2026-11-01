import { entityId } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

import { email, problem, tooMany } from './auth';
import { defineContract, WORKSPACE_ROLES } from './contract';
import { KEBAB_CASE, line } from './formats';
import { PendingInvitation } from './members';
import { timestamp } from './workspaces';

const WORKSPACE_ID = '0199d6a0-0000-7000-8000-000000000001';
const INVITATION_ID = '0199d6a0-0000-7000-8000-000000000201';
const TOKEN = 'Zm9yIHRoZSBleGFtcGxlIG9ubHkgbm90IGEgdG9rZW4';
const pending = {
  id: INVITATION_ID, email: 'alan@homelab.example', role: 'viewer', invitedBy: 'Ada', expiresAt: '2026-11-08T09:00:00.000Z',
};

/** How long an invitation link works. */
export const INVITATION_DAYS = 7;

/** A link's token: 32 random bytes in base64url. Only its SHA-256 hash is stored. */
export const INVITATION_TOKEN = /^[\w-]{43}$/;

const tokenParams = z.object({
  token: z.string().max(43).regex(INVITATION_TOKEN).meta({ description: 'The token of the invitation link', examples: [TOKEN] }),
});
const notFound = (instance: string) => problem(
  'No invitation has this link: it may have expired, been used or been revoked',
  'invitation_not_found',
  'This invitation does not exist or is no longer valid.',
  instance,
);
const TOKEN_PATH = `/api/invitations/${TOKEN}`;
const INVITATIONS_PATH = `/api/workspaces/${WORKSPACE_ID}/invitations`;

export const createInvitation = defineContract({
  method: 'post',
  path: '/api/workspaces/:workspaceId/invitations',
  operationId: 'createInvitation',
  summary: 'Invite someone',
  description: `Creates a link that adds the person with this email to the workspace with this role, valid ${String(INVITATION_DAYS)} days `
    + 'and once. The link is only in this answer: only its hash is stored. Inviting the same email again replaces the '
    + 'old link. Admins invite editors and viewers; owners invite any role.',
  tags: ['Workspaces'],
  requiredRole: 'admin',
  params: z.object({ workspaceId: entityId().meta({ description: 'The workspace\'s id', examples: [WORKSPACE_ID] }) }),
  body: z.strictObject({
    email: email(),
    role: z.enum(WORKSPACE_ROLES).meta({ description: 'Their role once they accept', examples: ['viewer'] }),
  }).meta({ description: 'Whom to invite, and as what' }),
  responses: {
    201: {
      description: 'The invitation and its link, shown once',
      schema: z.object({
        invitation: PendingInvitation,
        url: z.string().max(60).regex(/^\/invite\/[\w-]{43}$/).meta({
          description: 'The link\'s path, to send to the person',
          examples: [`/invite/${TOKEN}`],
        }),
      }).meta({ id: 'CreatedInvitation', description: 'A new invitation', examples: [{ invitation: pending, url: `/invite/${TOKEN}` }] }),
      examples: { created: { summary: 'A viewer invited', value: { invitation: pending, url: `/invite/${TOKEN}` } } },
    },
    403: problem('The caller may not grant this role', 'forbidden', 'Admins invite editors and viewers only.', INVITATIONS_PATH),
    409: problem('The person is already a member', 'already_member', 'This email belongs to a member already.', INVITATIONS_PATH),
  },
});

export const revokeInvitation = defineContract({
  method: 'delete',
  path: '/api/workspaces/:workspaceId/invitations/:invitationId',
  operationId: 'revokeInvitation',
  summary: 'Revoke an invitation',
  description: 'Deletes a pending invitation: its link stops working.',
  tags: ['Workspaces'],
  requiredRole: 'admin',
  params: z.object({
    workspaceId: entityId().meta({ description: 'The workspace\'s id', examples: [WORKSPACE_ID] }),
    invitationId: entityId().meta({ description: 'The invitation\'s id', examples: [INVITATION_ID] }),
  }),
  responses: {
    204: { description: 'Revoked', schema: z.null(), examples: { revoked: { summary: 'Revoked', value: null } } },
    403: problem('The caller may not revoke an invitation for this role', 'forbidden', 'Admins revoke invitations for editors and viewers only.', `${INVITATIONS_PATH}/${INVITATION_ID}`),
    404: notFound(`${INVITATIONS_PATH}/${INVITATION_ID}`),
  },
});

export const getInvitation = defineContract({
  method: 'get',
  path: '/api/invitations/:token',
  operationId: 'getInvitation',
  summary: 'Read an invitation',
  description: 'What an invitation link offers, for its page. It says nothing about whether the email has an account.',
  tags: ['Accounts'],
  requiredRole: 'public',
  params: tokenParams,
  responses: {
    200: {
      description: 'The invitation',
      schema: z.object({
        workspace: line(100).meta({ description: 'The workspace\'s name', examples: ['Demo'] }),
        role: z.enum(WORKSPACE_ROLES).meta({ description: 'The role it gives', examples: ['viewer'] }),
        email: email(),
        invitedBy: line(100).nullable().meta({ description: 'Who invited them', examples: ['Ada'] }),
        expiresAt: timestamp().meta({ description: 'When the link stops working', examples: [pending.expiresAt] }),
      }).meta({
        id: 'Invitation',
        description: 'An invitation, as its link shows it',
        examples: [{ workspace: 'Demo', role: 'viewer', email: pending.email, invitedBy: 'Ada', expiresAt: pending.expiresAt }],
      }),
      examples: {
        viewer: {
          summary: 'A viewer invited to Demo',
          value: { workspace: 'Demo', role: 'viewer', email: pending.email, invitedBy: 'Ada', expiresAt: pending.expiresAt },
        },
      },
    },
    404: notFound(TOKEN_PATH),
  },
});

export const acceptInvitation = defineContract({
  method: 'post',
  path: '/api/invitations/:token/accept',
  operationId: 'acceptInvitation',
  summary: 'Accept an invitation',
  description: 'Adds the signed-in account to the workspace with the invitation\'s role, and uses the link up. The '
    + 'account\'s email must be the invited one: links create no accounts, since whoever holds one could claim its email.',
  tags: ['Accounts'],
  requiredRole: 'signedIn',
  params: tokenParams,
  responses: {
    200: {
      description: 'Accepted: the workspace to open',
      schema: z.object({
        slug: z.string().max(48).regex(KEBAB_CASE).meta({ description: 'The workspace\'s slug', examples: ['demo'] }),
      }),
      examples: { accepted: { summary: 'Accepted', value: { slug: 'demo' } } },
    },
    403: problem('The invitation is for another email', 'invitation_email_mismatch', 'This invitation is for another email.', `${TOKEN_PATH}/accept`),
    404: notFound(`${TOKEN_PATH}/accept`),
    429: tooMany(`${TOKEN_PATH}/accept`),
  },
});
