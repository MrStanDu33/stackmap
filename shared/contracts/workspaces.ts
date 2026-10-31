import { entityId } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

import { defineContract } from './contract';
import { Problem, problemOf } from './errors';
import { KEBAB_CASE, line } from './formats';

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

const slug = () => z.string().max(48).regex(KEBAB_CASE);

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

export const getWorkspaceBySlug = defineContract({
  method: 'get',
  path: '/api/workspaces/by-slug/:slug',
  operationId: 'getWorkspaceBySlug',
  summary: 'Find a workspace by its slug',
  description: 'Gives the workspace with this slug, such as `demo`, the workspace the app seeds with the demo stack.',
  tags: ['Workspaces'],
  requiredRole: 'viewer',
  params: z.object({
    slug: slug().meta({ description: 'The workspace\'s slug', examples: ['demo'] }),
  }),
  responses: {
    200: {
      description: 'The workspace',
      schema: WorkspaceSummary,
      examples: { demo: { summary: 'The demo workspace', value: workspace } },
    },
    404: {
      description: 'No workspace has this slug',
      schema: Problem,
      examples: {
        workspace_not_found: {
          summary: 'Unknown slug',
          value: problemOf('workspace_not_found', {
            detail: 'No workspace demo.',
            instance: '/api/workspaces/by-slug/demo',
          }),
        },
      },
    },
  },
});
