import { z } from 'zod';

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

const CODES = Object.keys(PROBLEMS) as [ProblemCode, ...ProblemCode[]];

export const ProblemIssue = z.object({
  path: z.string().min(1).meta({
    description: 'Where: `params.<name>`, `query.<name>`, `body.<path>`, or `response.<path>` outside production',
    examples: ['body.name'],
  }),
  message: z.string().min(1).meta({ description: 'What is wrong there', examples: ['Too small: expected string to have >=1 characters'] }),
}).meta({
  id: 'ProblemIssue',
  description: 'One invalid value',
  examples: [{ path: 'body.name', message: 'Too small: expected string to have >=1 characters' }],
});

/** An API error, as RFC 9457 Problem Details. */
export const Problem = z.object({
  type: z.string().regex(/^urn:stackmap:problem:[a-z_]+$/).meta({
    description: 'Identifies the kind of problem: `urn:stackmap:problem:<code>`',
    examples: ['urn:stackmap:problem:validation_failed'],
  }),
  title: z.string().min(1).meta({
    description: 'A short summary of the kind of problem, the same for every occurrence',
    examples: [PROBLEMS.validation_failed.title],
  }),
  status: z.number().int().min(400).max(599).meta({ description: 'The HTTP status code', examples: [400] }),
  detail: z.string().min(1).meta({
    description: 'What went wrong this time, for people',
    examples: ['The request does not match the API contract.'],
  }),
  instance: z.string().min(1).meta({ description: 'The path of the request that failed', examples: ['/api/things/abc'] }),
  code: z.enum(CODES).meta({
    description: `The kind of problem, stable and machine-readable so the interface can translate it:\n\n${
      Object.entries(PROBLEMS).map(([code, { status, description }]) =>
        `- \`${code}\` (${String(status)}): ${description}`).join('\n')}`,
    examples: ['validation_failed'],
  }),
  issues: z.array(ProblemIssue).optional().meta({
    description: 'Every invalid value, for `validation_failed` and `invalid_response`',
  }),
}).meta({
  id: 'Problem',
  description: 'An API error, as RFC 9457 Problem Details (`application/problem+json`)',
  examples: [{
    type: 'urn:stackmap:problem:validation_failed',
    title: PROBLEMS.validation_failed.title,
    status: 400,
    detail: 'The request does not match the API contract.',
    instance: '/api/things/abc',
    code: 'validation_failed',
    issues: [{ path: 'params.id', message: 'Invalid string: must match pattern /^\\d+$/' }],
  }],
});

export type Problem = z.infer<typeof Problem>;

/** The Problem Details of one occurrence of a problem. */
export const problemOf = (
  code: ProblemCode,
  { detail, instance, issues }: { detail: string; instance: string; issues?: Problem['issues'] },
): Problem => ({
  type: `urn:stackmap:problem:${code}`,
  title: PROBLEMS[code].title,
  status: PROBLEMS[code].status,
  detail,
  instance,
  code,
  ...(issues === undefined ? {} : { issues }),
});
