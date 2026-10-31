import { z } from 'zod';

import { defineContract, WORKSPACE_ROLES } from './contract';
import { httpUrl, name, semver, text } from './formats';

export { SEMVER } from './formats';

const up = { status: 'ok', version: '1.4.0', database: 'ok' } as const;
const databaseDown = { status: 'error', version: '1.4.0', database: 'error' } as const;

export const Health = z.object({
  status: z.enum(['ok', 'error']).meta({ description: '`ok` when the app and its database answer', examples: ['ok'] }),
  version: semver().meta({ description: 'The version of Stackmap running', examples: ['1.4.0'] }),
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

const JsonArray: z.ZodType<unknown[]> = z.array(z.lazy(() => JsonValue)).max(10_000)
  .meta({ id: 'JsonArray', description: 'A JSON array', examples: [['ok', 'error']] });

const JsonObject: z.ZodType<Record<string, unknown>> = z.record(text(200), z.lazy(() => JsonValue))
  .meta({ id: 'JsonObject', description: 'A JSON object', examples: [{ type: 'string' }] });

/** Any JSON value, typed: what schemas and examples embedded in the OpenAPI document are made of. */
export const JsonValue: z.ZodType = z.union([text(10_000), z.number(), z.boolean(), z.null(), JsonArray, JsonObject])
  .meta({ id: 'JsonValue', description: 'Any JSON value', examples: [{ type: 'string', maxLength: 40 }] });

const docs = z.object({
  description: text(200).min(1).meta({ description: 'What the link is about', examples: ['Architecture'] }),
  url: httpUrl().meta({ description: 'Where it is', examples: ['https://github.com/MrStanDu33/stackmap'] }),
}).meta({ description: 'A link to documentation' });

const mediaType = z.object({
  schema: JsonValue.meta({ description: 'The JSON Schema of the content' }),
  examples: z.record(name(), z.object({
    summary: text(200).meta({ description: 'What the example shows', examples: ['Everything is up'] }),
    value: JsonValue.meta({ description: 'The example itself' }),
  }).meta({ description: 'A named example' })).optional().meta({ description: 'Named examples of the content' }),
}).meta({ description: 'Content of one media type' });
const content = z.record(z.string().max(100).regex(/^[\w.+-]+\/[\w.+-]+$/), mediaType)
  .meta({ description: 'Content by media type' });

const response = z.union([
  z.object({
    $ref: z.string().max(200).regex(/^#\/components\/responses\/[\w.-]+$/).meta({ description: 'A shared response' }),
  }),
  z.object({
    description: text(1000).meta({ description: 'What the response means', examples: ['The app is up'] }),
    content: content.optional(),
  }),
]).meta({ description: 'A response, or a reference to a shared one' });

const operation = z.object({
  operationId: z.string().max(100).regex(/^[A-Za-z][A-Za-z0-9]*$/)
    .meta({ description: 'Unique id', examples: ['getHealth'] }),
  summary: text(200).meta({ description: 'What it does, in a line', examples: ['Check that the app is up'] }),
  description: text(5000).meta({ description: 'What it does, and the role it needs' }),
  tags: z.array(text(50)).max(5).meta({ description: 'Its tags' }),
  deprecated: z.boolean().optional().meta({ description: 'Whether it will go away' }),
  externalDocs: docs.optional(),
  security: z.array(z.record(name(), z.array(text(100)).max(20))).max(10).optional()
    .meta({ description: 'Its security requirements; empty when public' }),
  parameters: z.array(z.object({
    in: z.enum(['path', 'query', 'header', 'cookie']).meta({ description: 'Where it goes', examples: ['path'] }),
    name: name().meta({ description: 'Its name', examples: ['id'] }),
    description: text(1000).optional().meta({ description: 'What it is' }),
    required: z.boolean().optional().meta({ description: 'Whether it is required' }),
    schema: JsonValue.meta({ description: 'Its JSON Schema' }),
    example: JsonValue.optional().meta({ description: 'An example value' }),
  }).meta({ description: 'A parameter' })).max(50).optional().meta({ description: 'Its parameters' }),
  requestBody: z.object({
    description: text(1000).optional().meta({ description: 'What the body is' }),
    required: z.boolean().meta({ description: 'Whether a body is required' }),
    content,
  }).optional().meta({ description: 'Its request body' }),
  responses: z.record(z.string().max(3).regex(/^[1-5]\d\d$/), response)
    .meta({ description: 'Its responses, by status' }),
  'x-required-role': z.enum(['public', 'signedIn', 'instanceAdmin', ...WORKSPACE_ROLES])
    .meta({ description: 'The role it needs', examples: ['viewer'] }),
}).meta({ description: 'An operation' });

const minimalDocument = { openapi: '3.1.1', info: { title: 'Stackmap API', version: '1' }, paths: {} };

export const OpenApiDocument = z.object({
  openapi: z.string().max(10).regex(/^3\.1\.\d+$/).meta({ description: 'The OpenAPI version', examples: ['3.1.1'] }),
  jsonSchemaDialect: httpUrl().optional().meta({ description: 'The JSON Schema dialect of its schemas' }),
  info: z.object({
    title: text(100).meta({ description: 'The API\'s name', examples: ['Stackmap API'] }),
    summary: text(300).optional().meta({ description: 'The API in a line' }),
    description: text(10_000).optional().meta({ description: 'The API and its conventions, in Markdown' }),
    version: text(20).meta({ description: 'The API\'s version', examples: ['1'] }),
    contact: z.object({
      name: text(100).meta({ description: 'Who maintains it', examples: ['Stackmap'] }),
      url: httpUrl().meta({ description: 'Where to reach them' }),
    }).optional().meta({ description: 'Who to contact' }),
    license: z.object({
      name: text(100).meta({ description: 'The license', examples: ['All rights reserved'] }),
      url: httpUrl().meta({ description: 'Its text' }),
    }).optional().meta({ description: 'Under which terms the API may be used' }),
  }).meta({ description: 'About the API' }),
  servers: z.array(z.object({
    url: z.string().max(2048).regex(/^\S+$/)
      .meta({ description: 'Its URL, possibly a template', examples: ['{scheme}://{host}'] }),
    description: text(200).meta({ description: 'Which server it is' }),
    variables: z.record(name(), z.object({
      default: text(200).meta({ description: 'Its value unless set', examples: ['http'] }),
      enum: z.array(text(50)).max(20).optional().meta({ description: 'Its allowed values' }),
      description: text(500).meta({ description: 'What it is' }),
    }).meta({ description: 'A variable of the URL' })).optional().meta({ description: 'Variables of the URL template' }),
  }).meta({ description: 'A server' })).max(10).optional().meta({ description: 'Where the API is' }),
  tags: z.array(z.object({
    name: text(50).meta({ description: 'Its name', examples: ['System'] }),
    description: text(1000).meta({ description: 'What its operations are about' }),
    externalDocs: docs.optional(),
  }).meta({ description: 'A tag' })).max(50).optional().meta({ description: 'The tags of its operations' }),
  externalDocs: docs.optional(),
  paths: z.record(z.string().max(200).regex(/^\/api(?:\/[\w.{}-]+)*$/), z.object({
    get: operation.optional(),
    post: operation.optional(),
    put: operation.optional(),
    patch: operation.optional(),
    delete: operation.optional(),
  }).meta({ description: 'The operations of a path' })).meta({ description: 'Every operation, by path and method' }),
  components: z.object({
    schemas: z.record(name(), JsonValue).optional().meta({ description: 'Shared JSON Schemas' }),
    responses: z.record(name(), response).optional().meta({ description: 'Shared responses' }),
    securitySchemes: z.record(name(), z.object({
      type: z.enum(['apiKey', 'http', 'oauth2', 'openIdConnect']).meta({ description: 'Its kind', examples: ['apiKey'] }),
      in: z.enum(['cookie', 'header', 'query']).meta({ description: 'Where it goes', examples: ['cookie'] }),
      name: name().meta({ description: 'The cookie, header or parameter', examples: ['better-auth.session_token'] }),
      description: text(1000).meta({ description: 'What it is' }),
    }).meta({ description: 'A security scheme' })).optional().meta({ description: 'Ways to authenticate' }),
  }).optional().meta({ description: 'What the document shares between operations' }),
  security: z.array(z.record(name(), z.array(text(100)).max(20))).max(10).optional()
    .meta({ description: 'What the operations require by default' }),
}).meta({ id: 'OpenApiDocument', description: 'An OpenAPI 3.1 document', examples: [minimalDocument] });

export const getOpenApiDocument = defineContract({
  method: 'get',
  path: '/api/openapi.json',
  operationId: 'getOpenApiDocument',
  summary: 'Get this OpenAPI document',
  description: 'The OpenAPI 3.1 description of this API, generated from the contracts of its routes, with this '
    + 'instance as its server. `/api/docs` shows it as a browsable reference.',
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
