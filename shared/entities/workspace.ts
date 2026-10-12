import { z } from 'zod';

import { entityName } from './common';
import { KEBAB_CASE } from '../contracts/formats';

export interface WorkspaceInput {
  name: string;
  slug: string;
}

/** An isolated set of infrastructure data, shared by its members. */
export interface Workspace extends WorkspaceInput {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export const workspaceSchema: z.ZodType<WorkspaceInput, WorkspaceInput> = z.strictObject({
  name: entityName(),
  slug: z.string().max(48).regex(KEBAB_CASE),
});
