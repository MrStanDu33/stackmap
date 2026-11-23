import { entityId } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

import { defineContract } from './contract';
import { Problem, problemOf } from './errors';
import { kebabId, line, text } from './formats';

const WORKSPACE_ID = '0199d6a0-0000-7000-8000-000000000001';

/** The most results a search gives. */
export const MAX_SEARCH_LIMIT = 50;

const router = {
  extension: 'core',
  entity: 'host',
  id: '0199d6a0-0000-7000-8000-000000000002',
  title: 'Edge router',
  matched: 'name',
};

export const SearchHit = z.object({
  extension: kebabId().meta({ description: 'The extension of its type', examples: ['core'] }),
  entity: kebabId().meta({ description: 'Its type, in the extension', examples: ['host'] }),
  id: entityId().meta({ description: 'Its id', examples: [router.id] }),
  title: text(200).meta({ description: 'What names it: its first search field\'s value, or its id', examples: [router.title] }),
  matched: text(100).meta({
    description: 'The search field whose value matched first, or `tags`',
    examples: ['name'],
  }),
}).meta({ id: 'SearchHit', description: 'An entity search found', examples: [router] });

export type SearchHit = z.infer<typeof SearchHit>;

export const searchWorkspace = defineContract({
  method: 'get',
  path: '/api/workspaces/:workspaceId/search',
  operationId: 'searchWorkspace',
  summary: 'Search a workspace',
  description: 'The workspace\'s entities whose search fields (a host\'s name and addresses, a DNS record\'s name and '
    + 'value, a route\'s hostnames…) or tags contain every word of `q`, ignoring case and accents, then those holding '
    + 'its letters in that order (the first 32). Those holding every word come first; then titles that start with `q`, '
    + 'then the others, each by title. Entities of extensions turned off in the workspace are left out.',
  tags: ['Search'],
  requiredRole: 'viewer',
  params: z.object({
    workspaceId: entityId().meta({ description: 'The workspace', examples: [WORKSPACE_ID] }),
  }),
  query: z.object({
    // Trimmed after the bounds: a query of spaces only is refused.
    q: line(100).trim().min(1).meta({ description: 'The words to find, at most 100 characters', examples: ['router'] }),
    limit: z.coerce.number().int().min(1).max(MAX_SEARCH_LIMIT).default(20)
      .meta({ description: 'The most results to give', examples: [20] }),
    // Unknown ids find nothing rather than being refused: the answer does not say what is installed.
    extension: kebabId().optional()
      .meta({ description: 'Search only this extension\'s entities; one that does not exist finds nothing', examples: ['nat'] }),
    entity: kebabId().optional()
      .meta({ description: 'Search only entities of this type, in every extension unless `extension` is given; one that '
        + 'does not exist finds nothing', examples: ['host'] }),
  }),
  responses: {
    200: {
      description: 'The entities found, possibly none',
      schema: z.object({
        items: z.array(SearchHit).max(MAX_SEARCH_LIMIT).meta({ description: 'Title prefix first, then by title' }),
        truncated: z.boolean().meta({ description: 'Whether more entities matched than `limit`', examples: [false] }),
      }).meta({ id: 'SearchResults', description: 'Search results', examples: [{ items: [router], truncated: false }] }),
      examples: {
        router: { summary: 'One host found', value: { items: [router], truncated: false } },
        none: { summary: 'Nothing found', value: { items: [], truncated: false } },
      },
    },
    404: {
      description: 'No such workspace, or one the caller is not a member of',
      schema: Problem,
      examples: {
        workspace_not_found: {
          summary: 'Unknown workspace',
          value: problemOf('workspace_not_found', {
            detail: `No workspace ${WORKSPACE_ID}.`,
            instance: `/api/workspaces/${WORKSPACE_ID}/search`,
          }),
        },
      },
    },
  },
});
