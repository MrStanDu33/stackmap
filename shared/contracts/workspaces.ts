import { entityId } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

import { defineContract, WORKSPACE_ROLES } from './contract';
import { Problem, problemOf } from './errors';
import { KEBAB_CASE, line } from './formats';

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

const slug = () => z.string().max(48).regex(KEBAB_CASE);

/** The workspace the app seeds with the demo stack. */
export const DEMO_WORKSPACE_SLUG = 'demo';

/** The cookie that remembers the last workspace opened, by slug, for `/`, `/graph` and `/trace`. */
export const WORKSPACE_COOKIE = 'stackmap-workspace';

/** An ISO 8601 UTC timestamp, such as 2026-10-31T09:00:00.000Z. */
export const timestamp = () => z.iso.datetime().max(30);

const workspace = {
  id: id(1),
  name: 'Demo',
  slug: 'demo',
  createdAt: '2026-10-31T09:00:00.000Z',
  updatedAt: '2026-10-31T09:00:00.000Z',
};

export const WorkspaceSummary = z.object({
  id: entityId().meta({ description: 'Its id', examples: [workspace.id] }),
  name: line(100).meta({ description: 'Its name', examples: [workspace.name] }),
  slug: slug().meta({ description: 'Its short name, unique on the instance', examples: [workspace.slug] }),
  createdAt: timestamp().meta({ description: 'When it was created', examples: [workspace.createdAt] }),
  updatedAt: timestamp().meta({ description: 'When it last changed', examples: [workspace.updatedAt] }),
}).meta({ id: 'Workspace', description: 'An isolated set of infrastructure data', examples: [workspace] });

export type WorkspaceSummary = z.infer<typeof WorkspaceSummary>;

export const MemberWorkspace = WorkspaceSummary.extend({
  role: z.enum(WORKSPACE_ROLES).meta({ description: 'The caller\'s role in it', examples: ['owner'] }),
}).meta({
  id: 'MemberWorkspace',
  description: 'A workspace the caller can open, with their role in it',
  examples: [{ ...workspace, role: 'owner' }],
});

export type MemberWorkspace = z.infer<typeof MemberWorkspace>;

export const MAX_WORKSPACES = 100;

const conflict = {
  description: 'Another workspace already uses this slug',
  schema: Problem,
  examples: {
    taken: {
      summary: 'A taken slug',
      value: problemOf('workspace_slug_taken', { detail: 'A workspace already uses the slug demo.', instance: '/api/workspaces' }),
    },
  },
};

export const listWorkspaces = defineContract({
  method: 'get',
  path: '/api/workspaces',
  operationId: 'listWorkspaces',
  summary: 'List your workspaces',
  description: 'The workspaces the caller is a member of, by name, each with their role. With '
    + '`INSTANCE_ADMIN_ALL_WORKSPACES` on, the instance administrator gets every workspace, as owner.',
  tags: ['Workspaces'],
  requiredRole: 'signedIn',
  responses: {
    200: {
      description: 'The caller\'s workspaces, possibly none',
      schema: z.object({
        workspaces: z.array(MemberWorkspace).max(MAX_WORKSPACES).meta({ description: 'By name' }),
      }).meta({ id: 'WorkspaceList', description: 'Workspaces', examples: [{ workspaces: [{ ...workspace, role: 'owner' }] }] }),
      examples: {
        demo: { summary: 'The demo workspace', value: { workspaces: [{ ...workspace, role: 'owner' }] } },
        none: { summary: 'Not a member of any workspace', value: { workspaces: [] } },
      },
    },
  },
});

export const createWorkspace = defineContract({
  method: 'post',
  path: '/api/workspaces',
  operationId: 'createWorkspace',
  summary: 'Create a workspace',
  description: 'Creates an empty workspace, with the caller as its owner.',
  tags: ['Workspaces'],
  requiredRole: 'instanceAdmin',
  body: z.strictObject({
    name: line(100).trim().min(1).meta({ description: 'Its name', examples: ['Homelab'] }),
    slug: slug().meta({ description: 'Its short name, used in links: unique on the instance', examples: ['homelab'] }),
  }).meta({ description: 'The new workspace' }),
  responses: {
    201: {
      description: 'The workspace, with the caller as owner',
      schema: MemberWorkspace,
      examples: { created: { summary: 'A new workspace', value: { ...workspace, name: 'Homelab', slug: 'homelab', role: 'owner' } } },
    },
    409: conflict,
  },
});
