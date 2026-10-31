import { createApp, createRouter, toWebHandler } from 'h3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defineContractHandler, MAX_BODY_BYTES } from './contract-handler';
import { defineContract } from '../../shared/contracts/contract';
import { Problem, problemOf } from '../../shared/contracts/errors';

import type { EventHandler } from 'h3';

const thing = defineContract({
  method: 'post',
  path: '/api/things/:id',
  operationId: 'updateThing',
  summary: 'Update a thing',
  description: 'Renames a thing.',
  tags: ['Things'],
  requiredRole: 'editor',
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  query: z.object({ dryRun: z.enum(['yes', 'no']).optional() }),
  body: z.object({ name: z.string().min(1) }),
  responses: {
    200: {
      description: 'Updated',
      schema: z.object({ id: z.string(), name: z.string(), dryRun: z.boolean() }),
      examples: { renamed: { summary: 'Renamed', value: { id: '42', name: 'Proxy', dryRun: false } } },
    },
    409: {
      description: 'Conflict',
      schema: z.object({ reason: z.string() }),
      examples: { taken: { summary: 'Name taken', value: { reason: 'taken' } } },
    },
  },
});

/** A response with nested objects and a default, to check what is sent. */
const account = defineContract({
  method: 'post',
  path: '/api/things/:id',
  operationId: 'getAccount',
  summary: 'Get an account',
  description: 'Returns an account.',
  tags: ['Things'],
  requiredRole: 'viewer',
  responses: {
    200: {
      description: 'The account',
      schema: z.object({
        user: z.object({ name: z.string() }),
        items: z.array(z.object({ id: z.string() })),
        plan: z.string().default('free'),
      }),
      examples: { ada: { summary: 'Ada', value: { user: { name: 'Ada' }, items: [], plan: 'free' } } },
    },
  },
});

/** A body with fields the contract does not declare, at every depth. */
const LEAKY_ACCOUNT = {
  user: { name: 'Ada', passwordHash: '$argon2id$…' },
  items: [{ id: 'a1', secret: 'token' }],
  debug: true,
};

/** Serves one handler at the contract's path and returns a fetch-like function. */
const serve = (handler: EventHandler) => {
  const router = createRouter().post('/api/things/:id', handler);
  const app = createApp().use(router);
  const fetchHandler = toWebHandler(app);
  return async (path: string, body?: string, headers: Record<string, string> = {}) => {
    const response = await fetchHandler(new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body,
    }));
    return { status: response.status, json: await response.json() as Record<string, unknown> };
  };
};

beforeEach(() => {
  // Failures are logged on purpose; keep the test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('defineContractHandler', () => {
  it('parses route params, query and JSON body with the contract schemas and passes them typed to the handler', async () => {
    const request = serve(defineContractHandler(thing, ({ params, query, body }) => ({
      status: 200,
      body: { id: params.id, name: body.name, dryRun: query.dryRun === 'yes' },
    })));

    expect(await request('/api/things/42?dryRun=yes', JSON.stringify({ name: 'Proxy' })))
      .toEqual({ status: 200, json: { id: '42', name: 'Proxy', dryRun: true } });
  });

  it('given invalid input, answers 400 validation_failed with the issues and does not run the handler', async () => {
    const handler = vi.fn();
    const request = serve(defineContractHandler(thing, handler));

    const { status, json } = await request('/api/things/abc?dryRun=maybe', JSON.stringify({ name: '' }));

    expect(status).toBe(400);
    expect(json).toMatchObject({ status: 400, code: 'validation_failed' });
    expect((json.issues as { path: string }[]).map(({ path }) => path).sort()).toEqual(['body.name', 'params.id', 'query.dryRun']);
    expect(handler).not.toHaveBeenCalled();
  });

  it('given a malformed JSON body, answers 400 validation_failed', async () => {
    const request = serve(defineContractHandler(thing, vi.fn()));

    expect(await request('/api/things/42', '{not json')).toMatchObject({
      status: 400,
      json: { status: 400, code: 'validation_failed' },
    });
  });

  it('accepts a JSON body whose content type has parameters', async () => {
    const request = serve(defineContractHandler(thing, ({ body }) => ({
      status: 200,
      body: { id: '42', name: body.name, dryRun: false },
    })));

    expect(await request('/api/things/42', JSON.stringify({ name: 'Proxy' }), {
      'content-type': 'application/json; charset=utf-8',
    })).toMatchObject({ status: 200, json: { name: 'Proxy' } });
  });

  it('given a body that is not JSON, answers 415 unsupported_media_type and does not run the handler', async () => {
    // A cross-site form or fetch can send text/plain without a CORS preflight.
    const handler = vi.fn();
    const request = serve(defineContractHandler(thing, handler));

    expect(await request('/api/things/42', JSON.stringify({ name: 'Proxy' }), { 'content-type': 'text/plain' }))
      .toMatchObject({ status: 415, json: { status: 415, code: 'unsupported_media_type' } });
    expect(handler).not.toHaveBeenCalled();
  });

  it('given a declared body length over the limit, answers 413 payload_too_large without reading it', async () => {
    const handler = vi.fn();
    const request = serve(defineContractHandler(thing, handler));

    expect(await request('/api/things/42', JSON.stringify({ name: 'Proxy' }), {
      'content-length': String(MAX_BODY_BYTES + 1),
    })).toMatchObject({ status: 413, json: { status: 413, code: 'payload_too_large' } });
    expect(handler).not.toHaveBeenCalled();
  });

  it('given a body that grows over the limit, answers 413 payload_too_large and does not run the handler', async () => {
    const handler = vi.fn();
    const request = serve(defineContractHandler(thing, handler));

    expect(await request('/api/things/42', JSON.stringify({ name: 'x'.repeat(MAX_BODY_BYTES) })))
      .toMatchObject({ status: 413, json: { status: 413, code: 'payload_too_large' } });
    expect(handler).not.toHaveBeenCalled();
  });

  it('outside production, given a response that does not match its schema, fails with a 500 naming the contract', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const request = serve(defineContractHandler(thing, () => ({ status: 200, body: { id: 42 } as never })));

    const { status, json } = await request('/api/things/42', JSON.stringify({ name: 'Proxy' }));

    expect(status).toBe(500);
    expect(json).toMatchObject({ status: 500, code: 'invalid_response' });
    expect(json.detail).toContain('updateThing');
  });

  it('outside production, given a response with an undeclared field at any depth, fails with a 500 and an issue per field', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const request = serve(defineContractHandler(account, () => ({ status: 200, body: LEAKY_ACCOUNT })));

    const { status, json } = await request('/api/things/42');

    expect(status).toBe(500);
    expect(json).toMatchObject({ status: 500, code: 'invalid_response' });
    expect(json.issues).toEqual([
      { path: 'response.user.passwordHash', message: 'Undeclared field' },
      { path: 'response.items.0.secret', message: 'Undeclared field' },
      { path: 'response.debug', message: 'Undeclared field' },
    ]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('getAccount'), expect.anything());
  });

  it('outside production, reports undeclared fields named like Object properties', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const body = { user: { name: 'Ada', constructor: 'leak', toString: 'leak' }, items: [] as { id: string }[] };
    const request = serve(defineContractHandler(account, () => ({ status: 200, body })));

    const { json } = await request('/api/things/42');

    expect(json.issues).toEqual([
      { path: 'response.user.constructor', message: 'Undeclared field' },
      { path: 'response.user.toString', message: 'Undeclared field' },
    ]);
  });

  it('in production, sends the response without its undeclared fields', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const request = serve(defineContractHandler(account, () => ({ status: 200, body: LEAKY_ACCOUNT })));

    expect(await request('/api/things/42')).toEqual({
      status: 200,
      json: { user: { name: 'Ada' }, items: [{ id: 'a1' }], plan: 'free' },
    });
  });

  it.each(['development', 'production'])('in %s, sends the parsed body: defaults applied, no extra keys', async (environment) => {
    vi.stubEnv('NODE_ENV', environment);
    const items: { id: string }[] = [];
    const request = serve(defineContractHandler(account, () => ({ status: 200, body: { user: { name: 'Ada' }, items } })));

    expect(await request('/api/things/42')).toEqual({ status: 200, json: { user: { name: 'Ada' }, items: [], plan: 'free' } });
  });

  it('in production, given a response that does not match its schema, answers 500 internal_error and logs the issues', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const request = serve(defineContractHandler(thing, () => ({ status: 200, body: { id: 42 } as never })));

    const { status, json } = await request('/api/things/42', JSON.stringify({ name: 'Proxy' }));

    expect(status).toBe(500);
    expect(json).toMatchObject({ status: 500, code: 'internal_error' });
    expect(json).not.toHaveProperty('issues');
    expect(json.detail).toBe('An unexpected error happened; the server logs have the details.');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('updateThing'), expect.anything());
  });

  it('answers with any status declared in the contract', async () => {
    const request = serve(defineContractHandler(thing, () => ({ status: 409, body: { reason: 'taken' } })));

    expect(await request('/api/things/42', JSON.stringify({ name: 'Proxy' })))
      .toEqual({ status: 409, json: { reason: 'taken' } });
  });

  it('given a status the contract does not declare, fails like a response that does not match', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const request = serve(defineContractHandler(thing, () => ({ status: 418, body: {} } as never)));

    expect(await request('/api/things/42', JSON.stringify({ name: 'Proxy' })))
      .toMatchObject({ status: 500, json: { code: 'invalid_response' } });
  });

  it('never reveals the details of an unexpected error', async () => {
    const failing = serve(defineContractHandler(thing, () => {
      throw new Error('database exploded');
    }));

    const { json } = await failing('/api/things/42', JSON.stringify({ name: 'Proxy' }));

    expect(json).toMatchObject({ status: 500, code: 'internal_error' });
    expect(JSON.stringify(json)).not.toContain('exploded');
  });
});

describe('defineContractHandler: bounded problems', () => {
  it('keeps at most 100 issues, and says how many there were', async () => {
    const many = defineContract({
      method: 'post',
      path: '/api/things/:id',
      operationId: 'tagThings',
      summary: 'Tag things',
      description: 'Tags many things.',
      tags: ['Things'],
      requiredRole: 'editor',
      body: z.object({ tags: z.array(z.string().min(1)) }),
      responses: { 204: { description: 'Tagged', schema: z.null(), examples: { done: { summary: 'Done', value: null } } } },
    });
    const request = serve(defineContractHandler(many, vi.fn()));

    const { status, json } = await request('/api/things/42', JSON.stringify({ tags: Array.from({ length: 150 }, () => '') }));

    expect(status).toBe(400);
    expect(json.issues).toHaveLength(100);
    expect(json.detail).toMatch(/first 100 of 150/);
  });
});

describe('defineContractHandler: Problem Details', () => {
  it('answers every error as application/problem+json: type, title, status, detail, instance, code', async () => {
    const app = createApp().use(createRouter().post('/api/things/:id', defineContractHandler(thing, vi.fn())));
    const response = await toWebHandler(app)(new Request('http://localhost/api/things/abc?dryRun=yes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Proxy' }),
    }));

    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(await response.json()).toEqual({
      type: 'urn:stackmap:problem:validation_failed',
      title: 'The request does not match the API contract',
      status: 400,
      detail: expect.stringMatching(/\S/) as string,
      instance: '/api/things/abc',
      code: 'validation_failed',
      issues: [{ path: 'params.id', message: expect.any(String) as string }],
    });
  });

  it('answers an expected error the contract declares as Problem Details as application/problem+json too', async () => {
    const gone = { ...thing, responses: { ...thing.responses, 404: { ...thing.responses[409], schema: Problem } } };
    const problem = problemOf('workspace_not_found', { detail: 'No workspace 42.', instance: '/api/things/42' });
    const app = createApp().use(createRouter().post('/api/things/:id', defineContractHandler(gone, () => ({
      status: 404, body: problem,
    }))));
    const response = await toWebHandler(app)(new Request('http://localhost/api/things/42', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Proxy' }),
    }));

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(await response.json()).toEqual(problem);
  });
});
