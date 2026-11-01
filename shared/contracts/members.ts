import { entityId } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

import { email, problem } from './auth';
import { defineContract, WORKSPACE_ROLES } from './contract';
import { line } from './formats';
import { timestamp } from './workspaces';

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const WORKSPACE_ID = id(1);
const ada = { userId: id(101), name: 'Ada', email: 'ada@homelab.example', role: 'owner', joinedAt: '2026-10-31T09:00:00.000Z' };
const grace = { userId: id(102), name: 'Grace', email: 'grace@homelab.example', role: 'editor', joinedAt: '2026-11-01T09:00:00.000Z' };
const pending = {
  id: id(201), email: 'alan@homelab.example', role: 'viewer', invitedBy: 'Ada', expiresAt: '2026-11-08T09:00:00.000Z',
};

/** Most members and pending invitations a workspace lists. */
export const MAX_MEMBERS = 500;

const role = () => z.enum(WORKSPACE_ROLES).meta({ description: 'Their role in the workspace', examples: ['editor'] });

export const Member = z.object({
  userId: entityId().meta({ description: 'The account\'s id', examples: [ada.userId] }),
  name: line(100).meta({ description: 'Its name', examples: [ada.name] }),
  email: email(),
  role: role(),
  joinedAt: timestamp().meta({ description: 'When they joined', examples: [ada.joinedAt] }),
}).meta({ id: 'Member', description: 'A member of a workspace', examples: [ada] });

export type Member = z.infer<typeof Member>;

export const PendingInvitation = z.object({
  id: entityId().meta({ description: 'Its id', examples: [pending.id] }),
  email: email(),
  role: role(),
  invitedBy: line(100).nullable().meta({ description: 'Who invited them, or null once that account is gone', examples: ['Ada'] }),
  expiresAt: timestamp().meta({ description: 'When the link stops working', examples: [pending.expiresAt] }),
}).meta({ id: 'PendingInvitation', description: 'An invitation not accepted yet', examples: [pending] });

export type PendingInvitation = z.infer<typeof PendingInvitation>;

const workspaceParams = z.object({
  workspaceId: entityId().meta({ description: 'The workspace\'s id', examples: [WORKSPACE_ID] }),
});
const memberParams = workspaceParams.extend({
  userId: entityId().meta({ description: 'The member\'s account id', examples: [grace.userId] }),
});

const forbidden = (instance: string) => problem(
  'The caller may not manage this member or grant this role',
  'forbidden',
  'Admins manage editors and viewers only.',
  instance,
);
const notMember = (instance: string) => problem(
  'This user is not a member of the workspace',
  'member_not_found',
  'No member with this id in the workspace.',
  instance,
);
const lastOwner = (instance: string) => problem(
  'The change would leave the workspace without an owner',
  'last_owner',
  'A workspace needs at least one owner.',
  instance,
);
const MEMBER_PATH = `/api/workspaces/${WORKSPACE_ID}/members/${grace.userId}`;

export const listMembers = defineContract({
  method: 'get',
  path: '/api/workspaces/:workspaceId/members',
  operationId: 'listMembers',
  summary: 'List the members',
  description: 'The workspace\'s members by name, with their role. Admins and owners also get the pending invitations.',
  tags: ['Workspaces'],
  requiredRole: 'viewer',
  params: workspaceParams,
  responses: {
    200: {
      description: 'The members, and the pending invitations for admins and owners',
      schema: z.object({
        members: z.array(Member).max(MAX_MEMBERS).meta({ description: 'By name' }),
        invitations: z.array(PendingInvitation).max(MAX_MEMBERS).optional()
          .meta({ description: 'Pending invitations, for admins and owners only' }),
      }).meta({ id: 'MemberList', description: 'Members', examples: [{ members: [ada, grace], invitations: [pending] }] }),
      examples: {
        owner: { summary: 'As an owner', value: { members: [ada, grace], invitations: [pending] } },
        viewer: { summary: 'As a viewer', value: { members: [ada, grace] } },
      },
    },
  },
});

export const updateMember = defineContract({
  method: 'patch',
  path: '/api/workspaces/:workspaceId/members/:userId',
  operationId: 'updateMember',
  summary: 'Change a member\'s role',
  description: 'Admins change editors and viewers to editor or viewer; owners change any role. A workspace keeps at '
    + 'least one owner.',
  tags: ['Workspaces'],
  requiredRole: 'viewer',
  params: memberParams,
  body: z.strictObject({ role: role() }).meta({ description: 'The new role' }),
  responses: {
    200: { description: 'The member, with the new role', schema: Member, examples: { changed: { summary: 'Now a viewer', value: { ...grace, role: 'viewer' } } } },
    403: forbidden(MEMBER_PATH),
    404: notMember(MEMBER_PATH),
    409: lastOwner(MEMBER_PATH),
  },
});

export const removeMember = defineContract({
  method: 'delete',
  path: '/api/workspaces/:workspaceId/members/:userId',
  operationId: 'removeMember',
  summary: 'Remove a member, or leave',
  description: 'Admins remove editors and viewers; owners remove anyone; every member may remove themselves. A '
    + 'workspace keeps at least one owner.',
  tags: ['Workspaces'],
  requiredRole: 'viewer',
  params: memberParams,
  responses: {
    204: { description: 'Removed', schema: z.null(), examples: { removed: { summary: 'Removed', value: null } } },
    403: forbidden(MEMBER_PATH),
    404: notMember(MEMBER_PATH),
    409: lastOwner(MEMBER_PATH),
  },
});
