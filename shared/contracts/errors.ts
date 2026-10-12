import { z } from 'zod';

/** The body of every API error. `code` is stable and machine-readable, so the interface can translate it. */
export const ApiError = z.object({
  statusCode: z.number().int(),
  code: z.string(),
  message: z.string(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
}).meta({ id: 'ApiError', description: 'An API error' });

export type ApiError = z.infer<typeof ApiError>;

/** Every problem the API answers with: its HTTP status, its title (fixed per code) and when it happens. */
export const PROBLEMS = {
  validation_failed: {
    status: 400,
    title: 'The request does not match the API contract',
    description: 'A path parameter, query parameter or body is invalid or missing; `issues` says which.',
  },
  payload_too_large: {
    status: 413,
    title: 'The request body is too large',
    description: 'The body is over 1 MiB.',
  },
  unsupported_media_type: {
    status: 415,
    title: 'The request body must be JSON',
    description: 'The body is not `application/json`.',
  },
  internal_error: {
    status: 500,
    title: 'Something went wrong',
    description: 'An unexpected error; the server logs have the details.',
  },
  invalid_response: {
    status: 500,
    title: 'The response does not match the API contract',
    description: 'Outside production only: the server answered something its contract does not declare.',
  },
} as const;

export type ProblemCode = keyof typeof PROBLEMS;
