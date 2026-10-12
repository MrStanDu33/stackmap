import { z } from 'zod';

import { defineContract } from './contract';

/** A semantic version: 1.4.0, 2.0.0-beta.1. */
export const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const up = { status: 'ok', version: '1.4.0', database: 'ok' } as const;
const databaseDown = { status: 'error', version: '1.4.0', database: 'error' } as const;

export const Health = z.object({
  status: z.enum(['ok', 'error']).meta({ description: '`ok` when the app and its database answer', examples: ['ok'] }),
  version: z.string().regex(SEMVER).meta({ description: 'The version of Stackmap running', examples: ['1.4.0'] }),
  database: z.enum(['ok', 'error']).meta({ description: '`ok` when the database answers a query', examples: ['ok'] }),
}).meta({ id: 'Health', description: 'Whether the app and its database are up', examples: [up] });

export const getHealth = defineContract({
  method: 'get',
  path: '/api/health',
  operationId: 'getHealth',
  summary: 'Check that the app and its database are up',
  description: 'For the Docker healthcheck and uptime monitors: answers 200 when the app and its database answer, '
    + '503 otherwise. Why the database does not answer is in the server logs, never in the response.',
  tags: ['System'],
  requiredRole: 'public',
  responses: {
    200: {
      description: 'The app and its database are up',
      schema: Health,
      examples: { up: { summary: 'Everything is up', value: up } },
    },
    503: {
      description: 'The database does not answer',
      schema: Health,
      examples: { databaseDown: { summary: 'The database is down', value: databaseDown } },
    },
  },
});

const minimalDocument = { openapi: '3.1.1', info: { title: 'Stackmap API', version: '1' }, paths: {} };

export const OpenApiDocument = z.looseObject({
  openapi: z.string().min(1).meta({ description: 'The version of the OpenAPI specification', examples: ['3.1.1'] }),
  info: z.looseObject({}).meta({ description: 'The API\'s title, version, description, contact and license' }),
  paths: z.looseObject({}).meta({ description: 'Every operation, by path and method' }),
}).meta({ id: 'OpenApiDocument', description: 'An OpenAPI 3.1 document', examples: [minimalDocument] });

export const getOpenApiDocument = defineContract({
  method: 'get',
  path: '/api/openapi.json',
  operationId: 'getOpenApiDocument',
  summary: 'Get this OpenAPI document',
  description: 'The OpenAPI 3.1 description of this API, generated from the contracts of its routes. '
    + '`/api/docs` shows it as a browsable reference.',
  tags: ['System'],
  requiredRole: 'public',
  responses: {
    200: {
      description: 'The OpenAPI 3.1 document of the API',
      schema: OpenApiDocument,
      examples: { minimal: { summary: 'The start of the document', value: minimalDocument } },
    },
  },
});
