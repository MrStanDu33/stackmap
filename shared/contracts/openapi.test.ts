import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineContract } from './contract';
import { createOpenApiDocument } from './openapi';

import type { oas31 } from 'zod-openapi';

const Thing = z.object({ id: z.string(), name: z.string() }).meta({ id: 'Thing' });

const getThing = defineContract({
  method: 'get',
  path: '/api/things/:id',
  operationId: 'getThing',
  summary: 'Get a thing',
  tags: ['Things'],
  requiredRole: 'viewer',
  params: z.object({ id: z.string() }),
  query: z.object({ expand: z.string().optional() }),
  responses: { 200: { description: 'The thing', schema: Thing } },
});

const createThing = defineContract({
  method: 'post',
  path: '/api/things',
  operationId: 'createThing',
  summary: 'Create a thing',
  tags: ['Things'],
  requiredRole: 'editor',
  body: z.object({ name: z.string() }),
  responses: { 201: { description: 'The created thing', schema: Thing } },
});

const document = createOpenApiDocument([getThing, createThing]);

describe('OpenAPI document', () => {
  it('is an OpenAPI 3.1 document with every contract: path, method, operationId, summary, tags, parameters, body and responses', () => {
    expect(document.openapi).toBe('3.1.0');

    const get = document.paths?.['/api/things/{id}']?.get;
    expect(get).toMatchObject({ operationId: 'getThing', summary: 'Get a thing', tags: ['Things'] });
    expect((get?.parameters as oas31.ParameterObject[]).map(({ name, in: location }) => `${location}:${name}`))
      .toEqual(['path:id', 'query:expand']);
    expect(get?.responses).toHaveProperty(['200', 'content', 'application/json', 'schema']);
    // Operations with input also document the validation error.
    expect(get?.responses).toHaveProperty(['400', 'content', 'application/json', 'schema']);

    const post = document.paths?.['/api/things']?.post;
    expect(post?.requestBody).toHaveProperty(['content', 'application/json', 'schema']);
    expect(post?.responses).toHaveProperty('201');
    // Operations with a body also document the media type and size errors.
    expect(post?.responses).toHaveProperty(['413', 'content', 'application/json', 'schema']);
    expect(post?.responses).toHaveProperty(['415', 'content', 'application/json', 'schema']);
    expect(get?.responses).not.toHaveProperty('413');
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
