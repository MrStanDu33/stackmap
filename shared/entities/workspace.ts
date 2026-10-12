import { z } from 'zod';

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

export const workspaceSchema = z.never() as unknown as z.ZodType<WorkspaceInput, WorkspaceInput>;
