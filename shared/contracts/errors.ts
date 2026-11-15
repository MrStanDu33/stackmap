import { z } from 'zod';

import { kebabId, PATH, text } from './formats';

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
  unauthenticated: {
    status: 401,
    title: 'Sign in first',
    description: 'The operation needs a session, and the request has none, or an expired or invalid one.',
  },
  forbidden: {
    status: 403,
    title: 'You may not do this',
    description: 'The session\'s role is below the one the operation requires.',
  },
  invalid_origin: {
    status: 403,
    title: 'The request comes from another site',
    description: 'A request that changes something was sent by a page of another origin than `BETTER_AUTH_URL`.',
  },
  invalid_credentials: {
    status: 401,
    title: 'Email or password is incorrect',
    description: 'No account has this email and password; which one is wrong is not said.',
  },
  already_set_up: {
    status: 409,
    title: 'Stackmap is already set up',
    description: 'An account exists: the first administrator can only be created once.',
  },
  setup_closed: {
    status: 403,
    title: 'Setup is closed',
    description: 'The setup window, counted from the server start, has passed; restarting Stackmap opens it again.',
  },
  too_many_requests: {
    status: 429,
    title: 'Too many attempts',
    description: 'Too many attempts from this address; `Retry-After` says how many seconds to wait.',
  },
  workspace_not_found: {
    status: 404,
    title: 'The workspace does not exist',
    description: 'No workspace has this id, or the caller is not one of its members.',
  },
  workspace_slug_taken: {
    status: 409,
    title: 'The slug is taken',
    description: 'Another workspace already uses this slug.',
  },
  invitation_not_found: {
    status: 404,
    title: 'The invitation does not exist',
    description: 'No invitation has this link or id: it may have expired, been used or been revoked.',
  },
  invitation_email_mismatch: {
    status: 403,
    title: 'The invitation is for someone else',
    description: 'The invitation is for another email than the signed-in account\'s.',
  },
  already_member: {
    status: 409,
    title: 'Already a member',
    description: 'The person with this email is already a member of the workspace.',
  },
  member_not_found: {
    status: 404,
    title: 'Not a member',
    description: 'This user is not a member of the workspace.',
  },
  last_owner: {
    status: 409,
    title: 'A workspace needs an owner',
    description: 'The change would leave a workspace without an owner.',
  },
  user_not_found: {
    status: 404,
    title: 'The account does not exist',
    description: 'No account has this id.',
  },
  email_taken: {
    status: 409,
    title: 'The email is taken',
    description: 'An account already uses this email.',
  },
  last_admin: {
    status: 409,
    title: 'The instance needs an administrator',
    description: 'The change would leave the instance without an administrator.',
  },
  cannot_demote_self: {
    status: 409,
    title: 'Administrators cannot demote themselves',
    description: 'Another administrator has to change this account\'s role.',
  },
  cannot_reset_self: {
    status: 409,
    title: 'Administrators cannot reset their own password here',
    description: 'Another administrator has to give this account a temporary password.',
  },
  wrong_password: {
    status: 400,
    title: 'The current password is incorrect',
    description: 'Changing the password needs the current one.',
  },
  password_change_required: {
    status: 403,
    title: 'The password must be changed first',
    description: 'The account has a temporary password: change it before anything else.',
  },
  cannot_remove_self: {
    status: 409,
    title: 'Administrators cannot remove themselves',
    description: 'Another administrator has to remove this account.',
  },
  entity_type_not_found: {
    status: 404,
    title: 'No such entity type',
    description: 'No active extension declares this extension and entity id with a repository.',
  },
  extension_disabled: {
    status: 409,
    title: 'The extension is turned off',
    description: 'The extension of this entity type is turned off in this workspace; `extension` names it.',
  },
  extension_not_found: {
    status: 404,
    title: 'No such extension',
    description: 'No installed extension has this id.',
  },
  extension_always_on: {
    status: 409,
    title: 'The extension is always on',
    description: 'This extension cannot be turned off.',
  },
  entity_not_found: {
    status: 404,
    title: 'The entity does not exist',
    description: 'The workspace has no entity of this type with this id.',
  },
  entity_invalid: {
    status: 422,
    title: 'The entity is invalid',
    description: 'The entity breaks one of its rules, or names a kind no active extension provides; `issues` says which.',
  },
  reference_invalid: {
    status: 422,
    title: 'A reference points outside the workspace',
    description: 'A field refers to an entity that is not in the workspace; `field` names it when known.',
  },
  entity_conflict: {
    status: 409,
    title: 'The entity already exists',
    description: 'Another entity of the workspace has the same unique values; `fields` names them.',
  },
  entity_in_use: {
    status: 409,
    title: 'The entity is in use',
    description: 'Other entities refer to it; `dependents` says which and how many.',
  },
  entity_changed: {
    status: 409,
    title: 'The entity changed meanwhile',
    description: 'Another write changed the entity while this one was checked: reload it and try again.',
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

/** How many issues a problem lists at most; its detail says how many there were. */
export const MAX_ISSUES = 100;

/** The bounds of one issue, which the server cuts its issues to. */
export const ISSUE_LIMITS = { path: 500, message: 1000, param: 500, params: 20 } as const;

const MAX_PARAMS = ISSUE_LIMITS.params;

/**
 * Bounds the keys of a record. A typed check rather than a refine: a refine is a custom schema, which the response lint
 * rightly reads as loose.
 */
function maxEntries(maximum: number): z.core.$ZodCheck<Record<string, unknown>> {
  type Check = z.core.$ZodCheck<Record<string, unknown>>;
  const Check = z.core.$ZodCheck as unknown as new (def: z.core.$ZodCheckDef) => Check;
  const check = new Check({ check: 'max_size' });
  check._zod.check = (payload) => {
    if (Object.keys(payload.value).length > maximum) {
      payload.issues.push({
        code: 'too_big', origin: 'object', maximum, inclusive: true, input: payload.value, path: [],
        message: `Too big: expected at most ${String(maximum)} entries`,
      });
    }
  };
  return check;
}

export const ProblemIssue = z.object({
  path: text(ISSUE_LIMITS.path).min(1).meta({
    description: 'Where: `params.<name>`, `query.<name>`, `body.<path>`, or `response.<path>` outside production',
    examples: ['body.name'],
  }),
  message: text(ISSUE_LIMITS.message).min(1).meta({
    description: 'What is wrong there, in English',
    examples: ['Too small: expected string to have >=1 characters'],
  }),
  code: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_.-]*$/).optional().meta({
    description: 'What is wrong, stable so the interface can translate it: a Zod code (`too_small`, `invalid_format`…), '
      + '`unknown-kind`, or an extension\'s own (`core.duplicate-address`)',
    examples: ['too_small'],
  }),
  params: z.record(z.string().max(50).regex(/^\w+$/), z.union([text(ISSUE_LIMITS.param), z.number()]))
    .check(maxEntries(MAX_PARAMS))
    .optional()
    .meta({
      description: `The values the translation of \`code\` needs, at most ${String(MAX_PARAMS)}`,
      examples: [{ minimum: 1, origin: 'string' }],
      maxProperties: MAX_PARAMS,
    }),
}).meta({
  id: 'ProblemIssue',
  description: 'One invalid value',
  examples: [{
    path: 'body.name',
    message: 'Too small: expected string to have >=1 characters',
    code: 'too_small',
    params: { minimum: 1, origin: 'string' },
  }],
});

export const ProblemDependent = z.object({
  extension: kebabId().meta({ description: 'The extension of the referring entities', examples: ['core'] }),
  entity: text(100).min(1).meta({ description: 'The referring entity or owned row', examples: ['service'] }),
  count: z.number().int().min(1).meta({ description: 'How many refer to it', examples: [2] }),
}).meta({
  id: 'ProblemDependent',
  description: 'Entities that refer to the one being removed',
  examples: [{ extension: 'core', entity: 'service', count: 2 }],
});

/** An API error, as RFC 9457 Problem Details. */
export const Problem = z.object({
  type: z.string().max(100).regex(/^urn:stackmap:problem:[a-z_]+$/).meta({
    description: 'Identifies the kind of problem: `urn:stackmap:problem:<code>`',
    examples: ['urn:stackmap:problem:validation_failed'],
  }),
  title: text(200).min(1).meta({
    description: 'A short summary of the kind of problem, the same for every occurrence',
    examples: [PROBLEMS.validation_failed.title],
  }),
  status: z.number().int().min(400).max(599).meta({ description: 'The HTTP status code', examples: [400] }),
  detail: text(2000).min(1).meta({
    description: 'What went wrong this time, for people',
    examples: ['The request does not match the API contract.'],
  }),
  instance: z.string().max(2048).regex(PATH).meta({
    description: 'The path of the request that failed',
    examples: ['/api/things/abc'],
  }),
  code: z.enum(CODES).meta({
    description: `The kind of problem, stable and machine-readable so the interface can translate it:\n\n${
      Object.entries(PROBLEMS).map(([code, { status, description }]) =>
        `- \`${code}\` (${String(status)}): ${description}`).join('\n')}`,
    examples: ['validation_failed'],
  }),
  issues: z.array(ProblemIssue).max(MAX_ISSUES).optional().meta({
    description: `The invalid values (at most ${String(MAX_ISSUES)}), for \`validation_failed\` and \`invalid_response\``,
  }),
  workspaces: z.array(text(100)).max(MAX_ISSUES).optional().meta({
    description: 'For `last_owner` when removing an account: the workspaces it is the only owner of, by name',
    examples: [['Home lab']],
  }),
  field: text(200).min(1).nullable().optional().meta({
    description: 'For `reference_invalid`: the field holding the reference, null when it could not be told',
    examples: ['siteId'],
  }),
  fields: z.array(text(200).min(1)).max(MAX_ISSUES).optional().meta({
    description: 'For `entity_conflict`: the fields whose combination is already taken',
    examples: [['name']],
  }),
  dependents: z.array(ProblemDependent).max(MAX_ISSUES).optional().meta({
    description: 'For `entity_in_use`: what refers to the entity; empty when it could not be told',
  }),
  extension: kebabId().optional().meta({
    description: 'For `extension_disabled`: the extension turned off in the workspace',
    examples: ['nat'],
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
    issues: [{
      path: 'params.id',
      message: 'Invalid string: must match pattern /^\\d+$/',
      code: 'invalid_format',
      params: { format: 'regex' },
    }],
  }],
});

export type Problem = z.infer<typeof Problem>;

/** The Problem Details of one occurrence of a problem. */
export const problemOf = (
  code: ProblemCode,
  { detail, instance, ...extra }: {
    detail: string;
    instance: string;
  } & Pick<Problem, 'issues' | 'workspaces' | 'field' | 'fields' | 'dependents' | 'extension'>,
): Problem => ({
  type: `urn:stackmap:problem:${code}`,
  title: PROBLEMS[code].title,
  status: PROBLEMS[code].status,
  detail,
  instance,
  code,
  ...extra,
});
