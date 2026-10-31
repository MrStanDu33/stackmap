import { entityId } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

import { defineContract } from './contract';
import { KEBAB_CASE, line } from './formats';

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

const slug = () => z.string().max(48).regex(KEBAB_CASE);

/** The workspace the app seeds with the demo stack. */
export const DEMO_WORKSPACE_SLUG = 'demo';

/** An ISO 8601 UTC timestamp, such as 2026-10-31T09:00:00.000Z. */
const timestamp = () => z.iso.datetime().max(30);

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

export const MAX_WORKSPACES = 100;

export const listWorkspaces = defineContract({
  method: 'get',
  path: '/api/workspaces',
  operationId: 'listWorkspaces',
  summary: 'Find workspaces',
  description: 'Gives the demo workspace, the one the app seeds with the demo stack, or none when it does not '
    + 'exist. Until accounts exist, only the `demo` slug is accepted.',
  tags: ['Workspaces'],
  requiredRole: 'viewer',
  query: z.object({
    // shortcut: only the demo workspace can be looked up, so a guessed slug reveals no other workspace's id; phase 4
    // replaces this with the workspaces the caller is a member of.
    slug: z.enum([DEMO_WORKSPACE_SLUG]).meta({
      description: 'The workspace\'s slug: only `demo` until accounts exist',
      examples: [DEMO_WORKSPACE_SLUG],
    }),
  }),
  responses: {
    200: {
      description: 'The matching workspaces: one, or none for an unknown slug',
      schema: z.object({
        workspaces: z.array(WorkspaceSummary).max(MAX_WORKSPACES).meta({ description: 'By name' }),
      }).meta({ id: 'WorkspaceList', description: 'Workspaces', examples: [{ workspaces: [workspace] }] }),
      examples: {
        demo: { summary: 'The demo workspace', value: { workspaces: [workspace] } },
        none: { summary: 'An unknown slug', value: { workspaces: [] } },
      },
    },
  },
});
