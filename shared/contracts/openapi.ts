import { createDocument } from 'zod-openapi';

import { ApiError } from './errors';
import { CONTRACTS } from './index';
import { TAGS } from './tags';

import type { Contract } from './contract';
import type { TagDocs } from './tags';
import type { z } from 'zod';
import type { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from 'zod-openapi';

/** Version of the API document; bumped on breaking API changes, not with every app release. */
export const API_VERSION = '1';

export type OpenApiDocument = ReturnType<typeof createDocument>;

const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });

/** `/api/things/:id` → `/api/things/{id}` */
const toOpenApiPath = (path: string) => path.replace(/:(\w+)/g, '{$1}');

function toOperation(contract: Contract): ZodOpenApiOperationObject {
  const responses = Object.fromEntries(Object.entries(contract.responses)
    .map(([status, { description, schema }]) => [status, { description, ...json(schema) }]));
  const requestParams = {
    ...(contract.params === undefined ? {} : { path: contract.params }),
    ...(contract.query === undefined ? {} : { query: contract.query }),
  };
  const hasInput = contract.params !== undefined || contract.query !== undefined || contract.body !== undefined;

  return {
    operationId: contract.operationId,
    summary: contract.summary,
    ...(contract.description === undefined ? {} : { description: contract.description }),
    tags: [...contract.tags],
    ...(Object.keys(requestParams).length === 0 ? {} : { requestParams }),
    ...(contract.body === undefined ? {} : { requestBody: { required: true, ...json(contract.body) } }),
    responses: {
      ...responses,
      ...(hasInput ? { 400: { description: 'The request does not match the API contract', ...json(ApiError) } } : {}),
      ...(contract.body === undefined
        ? {}
        : {
            413: { description: 'The request body is too large', ...json(ApiError) },
            415: { description: 'The request body is not JSON', ...json(ApiError) },
          }),
    },
    'x-required-role': contract.requiredRole,
  };
}

/** The OpenAPI 3.1 document of the given contracts. */
export function createOpenApiDocument(
  contracts: readonly Contract[] = CONTRACTS,
  _tags: Readonly<Record<string, TagDocs>> = TAGS,
): OpenApiDocument {
  const paths: ZodOpenApiPathsObject = {};
  for (const contract of contracts) {
    const path = toOpenApiPath(contract.path);
    paths[path] = { ...paths[path], [contract.method]: toOperation(contract) };
  }
  return createDocument({
    openapi: '3.1.0',
    info: {
      title: 'Stackmap API',
      version: API_VERSION,
      description: 'Self-hosted documentation for your infrastructure. Every route is generated from its contract.',
    },
    paths,
  });
}
