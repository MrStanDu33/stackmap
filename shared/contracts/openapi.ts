import { createDocument } from 'zod-openapi';

import { WORKSPACE_ROLES } from './contract';
import { Problem, PROBLEMS, problemOf } from './errors';
import { CONTRACTS } from './index';
import { SESSION_COOKIE } from './security';
import { TAGS } from './tags';

import type { Contract, ContractResponse, Role, WorkspaceRole } from './contract';
import type { ProblemCode } from './errors';
import type { TagDocs } from './tags';
import type { z } from 'zod';
import type { ZodOpenApiOperationObject, ZodOpenApiPathsObject, ZodOpenApiResponseObject } from 'zod-openapi';

/** Version of the API document; bumped on breaking API changes, not with every app release. */
export const API_VERSION = '1';

export type OpenApiDocument = ReturnType<typeof createDocument>;

const REPOSITORY = 'https://github.com/MrStanDu33/stackmap';

const DESCRIPTION = `Stackmap documents your infrastructure (hosts, services, DNS, proxies, VPNs) and the flows between
them. Every route is generated from its contract, so this reference is always the API itself.

## Errors

Errors follow [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457), as \`application/problem+json\`:
\`type\`, \`title\`, \`status\`, \`detail\` and \`instance\`, plus a stable \`code\` and, for invalid input, \`issues\`.
Translate errors with \`code\`, not with \`title\` or \`detail\`.

## Authentication

Operations need the session cookie (\`${SESSION_COOKIE}\`) that signing in sets, except public ones.

## Roles

Each operation states the role it needs (\`x-required-role\`): \`public\`, \`signedIn\` (any session),
\`instanceAdmin\`, or a role in the workspace of its path, \`viewer\` < \`editor\` < \`admin\` < \`owner\`. It is
checked before the input: \`401\` without a session, \`403\` below the role, and \`404\` for a workspace the caller is
not a member of, the same answer as for one that does not exist.

## Strings

Names and labels in responses are i18n keys, such as \`extensions.core.name\`: the interface translates them.

## Versioning

\`info.version\` is the version of the API, raised on breaking changes, not with every release of Stackmap.`;

const isWorkspaceRole = (role: Role): role is WorkspaceRole => (WORKSPACE_ROLES as readonly Role[]).includes(role);

const roleSentence = (role: Role) => {
  if (role === 'public') {
    return 'Public: anyone can call it.';
  }
  if (role === 'signedIn') {
    return 'Requires a session.';
  }
  if (role === 'instanceAdmin') {
    return 'Requires the instance administrator.';
  }
  return `Requires the ${role} role.`;
};

/** `/api/things/:id` → `/api/things/{id}` */
const toOpenApiPath = (path: string) => path.replace(/:(\w+)/g, '{$1}');

/** A shared error response, registered once under components.responses (`id`) and referenced by the operations. */
const problemResponse = (
  id: string,
  description: string,
  examples: { code: ProblemCode; detail: string; issues?: Problem['issues'] }[],
): ZodOpenApiResponseObject => ({
  id,
  description,
  content: {
    'application/problem+json': {
      schema: Problem,
      examples: Object.fromEntries(examples.map(({ code, ...problem }) => [code, {
        summary: PROBLEMS[code].title,
        value: problemOf(code, { instance: '/api/things/42', ...problem }),
      }])),
    },
  },
});

const PROBLEM_RESPONSES = {
  validationFailed: problemResponse('ValidationFailed', PROBLEMS.validation_failed.description, [{
    code: 'validation_failed',
    detail: 'The request does not match the API contract.',
    issues: [{ path: 'body.name', message: 'Too small: expected string to have >=1 characters' }],
  }]),
  payloadTooLarge: problemResponse('PayloadTooLarge', PROBLEMS.payload_too_large.description, [{
    code: 'payload_too_large',
    detail: 'The request body is larger than 1048576 bytes.',
  }]),
  unsupportedMediaType: problemResponse('UnsupportedMediaType', PROBLEMS.unsupported_media_type.description, [{
    code: 'unsupported_media_type',
    detail: 'The request body must be JSON (application/json).',
  }]),
  unauthenticated: problemResponse('Unauthenticated', PROBLEMS.unauthenticated.description, [{
    code: 'unauthenticated',
    detail: 'Sign in to use this operation.',
  }]),
  forbidden: problemResponse('Forbidden', PROBLEMS.forbidden.description, [{
    code: 'forbidden',
    detail: 'This operation needs the editor role in the workspace.',
  }]),
  workspaceNotFound: problemResponse('WorkspaceNotFound', PROBLEMS.workspace_not_found.description, [{
    code: 'workspace_not_found',
    detail: 'No workspace with this id that you can open.',
  }]),
  internalError: problemResponse('InternalError', 'An unexpected error or, outside production, a response that does '
  + 'not match its contract', [
    { code: 'internal_error', detail: 'An unexpected error happened; the server logs have the details.' },
    { code: 'invalid_response', detail: 'The response of getThing does not match its contract.' },
  ]),
};

const json = (schema: z.ZodType, examples?: ContractResponse['examples']) =>
  ({ content: { 'application/json': { schema, ...(examples ? { examples } : {}) } } });

function toOperation(contract: Contract): ZodOpenApiOperationObject {
  // An expected error (404, 409…) is Problem Details, like the shared ones.
  const responses = Object.fromEntries(Object.entries(contract.responses)
    .map(([status, { description, schema, examples }]) => [status, {
      description,
      ...(schema === Problem
        ? { content: { 'application/problem+json': { schema, examples } } }
        : json(schema, examples)),
    }]));
  const requestParams = {
    ...(contract.params === undefined ? {} : { path: contract.params }),
    ...(contract.query === undefined ? {} : { query: contract.query }),
  };
  const hasInput = contract.params !== undefined || contract.query !== undefined || contract.body !== undefined;
  const bodyDescription = (contract.body?.meta() as { description?: string } | undefined)?.description;

  return {
    operationId: contract.operationId,
    summary: contract.summary,
    description: `${contract.description}\n\n${roleSentence(contract.requiredRole)}`,
    tags: [...contract.tags],
    ...(contract.deprecated ? { deprecated: true } : {}),
    // Public operations opt out of the session the document requires by default.
    ...(contract.requiredRole === 'public' ? { security: [] } : {}),
    ...(contract.externalDocs ? { externalDocs: contract.externalDocs } : {}),
    ...(Object.keys(requestParams).length === 0 ? {} : { requestParams }),
    ...(contract.body === undefined
      ? {}
      : {
          requestBody: {
            ...(bodyDescription ? { description: bodyDescription } : {}),
            required: true,
            ...json(contract.body),
          },
        }),
    responses: {
      ...responses,
      ...(hasInput ? { 400: PROBLEM_RESPONSES.validationFailed } : {}),
      // Checked before the input: a caller without a session, or below the role, learns nothing more.
      ...(contract.requiredRole === 'public' ? {} : { 401: PROBLEM_RESPONSES.unauthenticated }),
      ...(contract.requiredRole === 'public' || contract.requiredRole === 'signedIn' || contract.requiredRole === 'viewer'
        ? {}
        : { 403: PROBLEM_RESPONSES.forbidden }),
      // A workspace the caller is not a member of answers like one that does not exist.
      ...(isWorkspaceRole(contract.requiredRole) && !(404 in contract.responses)
        ? { 404: PROBLEM_RESPONSES.workspaceNotFound }
        : {}),
      ...(contract.body === undefined
        ? {}
        : { 413: PROBLEM_RESPONSES.payloadTooLarge, 415: PROBLEM_RESPONSES.unsupportedMediaType }),
      500: PROBLEM_RESPONSES.internalError,
    },
    'x-required-role': contract.requiredRole,
  };
}

/**
 * Contracts give examples in their schemas (`examples`, standard JSON Schema); a parameter shows its first one as the
 * parameter's own `example`, where the reference and the lint look for it.
 */
function withParameterExamples(document: OpenApiDocument): OpenApiDocument {
  for (const item of Object.values(document.paths ?? {})) {
    for (const operation of Object.values(item) as { parameters?: unknown[] }[]) {
      const parameters = (operation.parameters ?? []) as { example?: unknown; schema?: { examples?: unknown[] } }[];
      for (const parameter of parameters) {
        const [example] = parameter.schema?.examples ?? [];
        if (parameter.example === undefined && example !== undefined) {
          parameter.example = example;
        }
      }
    }
  }
  return document;
}

/** The OpenAPI 3.1 document of the given contracts, with the tags they use. */
export function createOpenApiDocument(
  contracts: readonly Contract[] = CONTRACTS,
  tags: Readonly<Record<string, TagDocs>> = TAGS,
): OpenApiDocument {
  const paths: ZodOpenApiPathsObject = {};
  for (const contract of contracts) {
    const path = toOpenApiPath(contract.path);
    paths[path] = { ...paths[path], [contract.method]: toOperation(contract) };
  }
  const used = new Set(contracts.flatMap((contract) => contract.tags));

  return withParameterExamples(createDocument({
    openapi: '3.1.1',
    jsonSchemaDialect: 'https://spec.openapis.org/oas/3.1/dialect/base',
    info: {
      title: 'Stackmap API',
      summary: 'Document your infrastructure: hosts, services, DNS, proxies and the flows between them.',
      description: DESCRIPTION,
      version: API_VERSION,
      contact: { name: 'Stackmap', url: `${REPOSITORY}/issues` },
      license: { name: 'All rights reserved', url: `${REPOSITORY}/blob/develop/LICENSE` },
    },
    // Absolute, for tools that read the document without its host; /api/openapi.json serves the instance's own.
    servers: [{
      url: '{scheme}://{host}',
      description: 'A Stackmap instance',
      variables: {
        scheme: { default: 'http', enum: ['http', 'https'], description: '`https` behind a TLS reverse proxy' },
        host: { default: 'localhost:3000', description: 'Host name and port of your Stackmap instance' },
      },
    }],
    tags: Object.entries(tags)
      .filter(([name]) => used.has(name))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, docs]) => ({ name, ...docs })),
    externalDocs: { description: 'Architecture', url: `${REPOSITORY}/blob/develop/docs/ARCHITECTURE.md` },
    paths,
    components: {
      securitySchemes: {
        session: {
          type: 'apiKey',
          in: 'cookie',
          name: SESSION_COOKIE,
          description: 'The session cookie that signing in (`POST /api/session`) sets. Over HTTPS its name has the '
            + '`__Secure-` prefix.',
        },
      },
    },
    security: [{ session: [] }],
  }));
}
