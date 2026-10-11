import { z } from 'zod';

import { defineContract } from './contract';

export const Health = z.object({
  status: z.enum(['ok', 'error']),
  version: z.string(),
  database: z.enum(['ok', 'error']),
}).meta({ id: 'Health', description: 'Whether the app and its database are up' });

export const getHealth = defineContract({
  method: 'get',
  path: '/api/health',
  operationId: 'getHealth',
  summary: 'Check that the app and its database are up',
  tags: ['System'],
  requiredRole: 'public',
  responses: {
    200: { description: 'The app and its database are up', schema: Health },
    503: { description: 'The database does not answer', schema: Health },
  },
});

export const getOpenApiDocument = defineContract({
  method: 'get',
  path: '/api/openapi.json',
  operationId: 'getOpenApiDocument',
  summary: 'Get this OpenAPI document',
  tags: ['System'],
  requiredRole: 'public',
  responses: {
    200: {
      description: 'The OpenAPI 3.1 document of the API',
      schema: z.looseObject({ openapi: z.string(), info: z.looseObject({}), paths: z.looseObject({}) }),
    },
  },
});
