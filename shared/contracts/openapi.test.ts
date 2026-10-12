import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineContract } from './contract';
import { PROBLEMS } from './errors';
import { API_VERSION, createOpenApiDocument } from './openapi';

import type { oas31 } from 'zod-openapi';

const Thing = z.object({
  id: z.string().min(1).meta({ description: 'Its id', examples: ['42'] }),
  name: z.string().min(1).meta({ description: 'Its name', examples: ['Proxy'] }),
}).meta({ id: 'Thing', description: 'A thing to test with', examples: [{ id: '42', name: 'Proxy' }] });

const thingExamples = { proxy: { summary: 'A proxy', value: { id: '42', name: 'Proxy' } } };

const getThing = defineContract({
  method: 'get',
  path: '/api/things/:id',
  operationId: 'getThing',
  summary: 'Get a thing',
  description: 'Gets one thing by its id.',
  tags: ['Things'],
  requiredRole: 'viewer',
  params: z.object({ id: z.string().meta({ description: 'The thing\'s id', examples: ['42'] }) }),
  query: z.object({ expand: z.string().optional().meta({ description: 'What to include', examples: ['owner'] }) }),
  responses: { 200: { description: 'The thing', schema: Thing, examples: thingExamples } },
});

const createThing = defineContract({
  method: 'post',
  path: '/api/things',
  operationId: 'createThing',
  summary: 'Create a thing',
  description: 'Creates a thing.',
  tags: ['Things'],
  requiredRole: 'editor',
  deprecated: true,
  externalDocs: { description: 'About things', url: 'https://example.com/things' },
  body: z.object({ name: z.string().min(1).meta({ description: 'Its name', examples: ['Proxy'] }) })
    .meta({ description: 'The thing to create', examples: [{ name: 'Proxy' }] }),
  responses: { 201: { description: 'The created thing', schema: Thing, examples: thingExamples } },
});

const TEST_TAGS = { Things: { description: 'Things to test with' } };

const document = createOpenApiDocument([getThing, createThing], TEST_TAGS);
/** The real document, of every contract. */
const api = createOpenApiDocument();

type Schema = oas31.SchemaObject | oas31.ReferenceObject;

/** Every schema in the document (components, parameters, bodies, responses), with where it is. */
const schemasOf = (doc: typeof api): [string, oas31.SchemaObject][] => {
  const found: [string, oas31.SchemaObject][] = [];
  const visit = (schema: Schema | undefined, where: string) => {
    if (!schema || '$ref' in schema) {
      return;
    }
    found.push([where, schema]);
    for (const [name, property] of Object.entries(schema.properties ?? {})) {
      visit(property, `${where}.${name}`);
    }
    if (schema.items && typeof schema.items === 'object') {
      visit(schema.items, `${where}[]`);
    }
    for (const option of [...(schema.anyOf ?? []), ...(schema.oneOf ?? []), ...(schema.allOf ?? [])]) {
      visit(option, where);
    }
  };
  for (const [name, schema] of Object.entries(doc.components?.schemas ?? {})) {
    visit(schema as Schema, name);
  }
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const [method, operation] of Object.entries(item) as [string, oas31.OperationObject][]) {
      for (const [status, response] of Object.entries(operation.responses ?? {})) {
        for (const [type, media] of Object.entries((response as oas31.ResponseObject).content ?? {})) {
          visit(media.schema, `${method} ${path} ${status} ${type}`);
        }
      }
    }
  }
  return found;
};

describe('OpenAPI document', () => {
  it('is an OpenAPI 3.1 document with every contract: path, method, operationId, summary, tags, parameters, body and responses', () => {
    const get = document.paths?.['/api/things/{id}']?.get;
    expect(get).toMatchObject({ operationId: 'getThing', summary: 'Get a thing', tags: ['Things'] });
    expect((get?.parameters as oas31.ParameterObject[]).map(({ name, in: location }) => `${location}:${name}`))
      .toEqual(['path:id', 'query:expand']);
    expect(get?.responses).toHaveProperty(['200', 'content', 'application/json', 'schema']);

    const post = document.paths?.['/api/things']?.post;
    expect(post?.requestBody).toHaveProperty(['content', 'application/json', 'schema']);
    expect(post?.responses).toHaveProperty('201');
  });

  it('records the required role of each operation as x-required-role', () => {
    expect(document.paths?.['/api/things/{id}']?.get).toHaveProperty('x-required-role', 'viewer');
    expect(document.paths?.['/api/things']?.post).toHaveProperty('x-required-role', 'editor');
  });

  it('emits schemas shared by several operations once, under components.schemas', () => {
    expect(document.components?.schemas).toHaveProperty('Thing');
    expect(document.paths?.['/api/things']?.post?.responses).toHaveProperty(
      ['201', 'content', 'application/json', 'schema', '$ref'],
      '#/components/schemas/Thing',
    );
  });

  it('matches the committed docs/api/openapi.json (update with pnpm test:unit -u)', async () => {
    await expect(`${JSON.stringify(createOpenApiDocument(), null, 2)}\n`)
      .toMatchFileSnapshot('../../docs/api/openapi.json');
  });
});

describe('OpenAPI document: top level', () => {
  it('is OpenAPI 3.1.1 with the 3.1 base JSON Schema dialect', () => {
    expect(api).toMatchObject({
      openapi: '3.1.1',
      jsonSchemaDialect: 'https://spec.openapis.org/oas/3.1/dialect/base',
    });
  });

  it('has an info summary, a Markdown description, a contact and a license', () => {
    expect(api.info).toMatchObject({
      title: 'Stackmap API',
      summary: expect.stringMatching(/\S/) as string,
      version: API_VERSION,
      contact: { name: 'Stackmap', url: 'https://github.com/MrStanDu33/stackmap/issues' },
      license: { name: 'All rights reserved', url: 'https://github.com/MrStanDu33/stackmap/blob/develop/LICENSE' },
    });
    for (const section of ['## Errors', '## Roles', '## Strings', '## Versioning']) {
      expect(api.info.description).toContain(section);
    }
  });

  it('describes the server as an absolute URL template, {scheme}://{host}, with its variables', () => {
    expect(api.servers).toEqual([{
      url: '{scheme}://{host}',
      description: 'A Stackmap instance',
      variables: {
        scheme: { default: 'http', enum: ['http', 'https'], description: expect.stringMatching(/\S/) as string },
        host: { default: 'localhost:3000', description: expect.stringMatching(/\S/) as string },
      },
    }]);
  });

  it('declares every tag an operation uses, with a description', () => {
    expect(document.tags).toEqual([{ name: 'Things', description: 'Things to test with' }]);

    const used = new Set(Object.values(api.paths ?? {})
      .flatMap((item) => Object.values(item) as oas31.OperationObject[])
      .flatMap(({ tags = [] }) => tags));
    const declared = api.tags ?? [];
    expect(declared.map(({ name }) => name).sort()).toEqual([...used].sort());
    for (const tag of declared) {
      expect(tag.description).toMatch(/\S/);
    }
  });

  it('links to the architecture document', () => {
    expect(api.externalDocs).toEqual({
      description: 'Architecture',
      url: 'https://github.com/MrStanDu33/stackmap/blob/develop/docs/ARCHITECTURE.md',
    });
  });

  it('holds the shared error responses as Problem Details, each with an example, referenced by the operations', () => {
    const responses = document.components?.responses ?? {};

    expect(Object.keys(responses).sort())
      .toEqual(['InternalError', 'PayloadTooLarge', 'UnsupportedMediaType', 'ValidationFailed']);
    for (const response of Object.values(responses) as oas31.ResponseObject[]) {
      expect(response.description).toMatch(/\S/);
      expect(response.content?.['application/problem+json']).toMatchObject({
        schema: { $ref: '#/components/schemas/Problem' },
      });
      expect(Object.keys(response.content?.['application/problem+json']?.examples ?? {})).not.toHaveLength(0);
    }
    expect(document.paths?.['/api/things/{id}']?.get?.responses?.['400'])
      .toEqual({ $ref: '#/components/responses/ValidationFailed' });
  });
});

describe('OpenAPI document: operations', () => {
  it('gives every operation an operationId, summary, description, tags and its required role, also in the description', () => {
    expect(document.paths?.['/api/things/{id}']?.get).toMatchObject({
      operationId: 'getThing',
      summary: 'Get a thing',
      description: 'Gets one thing by its id.\n\nRequires the viewer role.',
      tags: ['Things'],
      'x-required-role': 'viewer',
    });
    expect(api.paths?.['/api/health']?.get?.description).toMatch(/Public: anyone can call it\.$/);
  });

  it('documents 500 for every operation, 400 with input, 413 and 415 with a body', () => {
    const ref = (name: string) => ({ $ref: `#/components/responses/${name}` });

    expect(document.paths?.['/api/things/{id}']?.get?.responses).toMatchObject({
      400: ref('ValidationFailed'),
      500: ref('InternalError'),
    });
    expect(document.paths?.['/api/things/{id}']?.get?.responses).not.toHaveProperty('413');
    expect(document.paths?.['/api/things']?.post?.responses).toMatchObject({
      400: ref('ValidationFailed'),
      413: ref('PayloadTooLarge'),
      415: ref('UnsupportedMediaType'),
      500: ref('InternalError'),
    });
    expect(api.paths?.['/api/health']?.get?.responses).toMatchObject({ 500: ref('InternalError') });
  });

  it('gives every declared response a description and an example', () => {
    expect(document.paths?.['/api/things/{id}']?.get?.responses?.['200']).toMatchObject({
      description: 'The thing',
      content: { 'application/json': { examples: thingExamples } },
    });
  });

  it('marks deprecated operations and links their external docs', () => {
    expect(document.paths?.['/api/things']?.post).toMatchObject({
      deprecated: true,
      externalDocs: { description: 'About things', url: 'https://example.com/things' },
    });
    expect(document.paths?.['/api/things/{id}']?.get).not.toHaveProperty('deprecated');
  });

  it('describes every parameter and request body, with an example', () => {
    const parameters = document.paths?.['/api/things/{id}']?.get?.parameters as oas31.ParameterObject[];

    expect(parameters.map(({ name, description, example }) => ({ name, description, example: example as unknown })))
      .toEqual([
        { name: 'id', description: 'The thing\'s id', example: '42' },
        { name: 'expand', description: 'What to include', example: 'owner' },
      ]);
    expect(document.paths?.['/api/things']?.post?.requestBody).toMatchObject({
      description: 'The thing to create',
      required: true,
      content: { 'application/json': { schema: { examples: [{ name: 'Proxy' }] } } },
    });
  });
});

describe('OpenAPI document: schemas', () => {
  it('describes every object property, in components and inline', () => {
    const undescribed = schemasOf(api).flatMap(([where, schema]) => Object.entries(schema.properties ?? {})
      .filter(([, property]) => !('$ref' in property) && !property.description)
      .map(([name]) => `${where}.${name}`));

    expect(undescribed).toEqual([]);
  });

  it('gives every component schema a description and an example', () => {
    const schemas = (api.components?.schemas ?? {}) as Record<string, oas31.SchemaObject>;
    const incomplete = Object.entries(schemas)
      .filter(([, schema]) => !schema.description || (schema.examples ?? []).length === 0)
      .map(([name]) => name);

    expect(incomplete).toEqual([]);
  });

  it('lists the known problem codes as an enum, each described', () => {
    const code = (api.components?.schemas?.Problem as oas31.SchemaObject).properties?.code as oas31.SchemaObject;

    expect(code.enum).toEqual(Object.keys(PROBLEMS));
    for (const known of Object.keys(PROBLEMS)) {
      expect(code.description).toContain(`\`${known}\``);
    }
  });

  it('uses formats and patterns: semver versions, kebab-case ids, locale codes, coverage from 0 to 1', () => {
    const schemas = api.components?.schemas as Record<string, oas31.SchemaObject>;
    const property = (schema: string, name: string) => schemas[schema]?.properties?.[name] as oas31.SchemaObject;

    expect(property('Health', 'version').pattern).toBeDefined();
    expect(property('Extension', 'version').pattern).toBeDefined();
    expect(property('Extension', 'id').pattern).toBeDefined();
    expect(property('ExtensionKind', 'id').pattern).toBeDefined();
    expect(property('ExtensionLocale', 'code').pattern).toBeDefined();
    const languages = property('ExtensionDiagnostics', 'languages').items as oas31.SchemaObject;
    expect(languages.properties?.coverage).toMatchObject({ minimum: 0, maximum: 1 });
  });
});
