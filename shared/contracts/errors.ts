import { z } from 'zod';

/** The body of every API error. `code` is stable and machine-readable, so the interface can translate it. */
export const ApiError = z.object({
  statusCode: z.number().int(),
  code: z.string(),
  message: z.string(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
}).meta({ id: 'ApiError', description: 'An API error' });

export type ApiError = z.infer<typeof ApiError>;
