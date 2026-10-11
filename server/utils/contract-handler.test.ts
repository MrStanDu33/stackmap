import { createApp, createRouter, toWebHandler } from 'h3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defineContractHandler } from './contract-handler';
import { defineContract } from '../../shared/contracts/contract';

import type { EventHandler } from 'h3';

const thing = defineContract({
  method: 'post',
  path: '/api/things/:id',
  operationId: 'updateThing',
  summary: 'Update a thing',
  tags: ['Things'],
  requiredRole: 'editor',
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  query: z.object({ dryRun: z.enum(['yes', 'no']).optional() }),
  body: z.object({ name: z.string().min(1) }),
  responses: {
    200: { description: 'Updated', schema: z.object({ id: z.string(), name: z.string(), dryRun: z.boolean() }) },
    409: { description: 'Conflict', schema: z.object({ reason: z.string() }) },
  },
});

/** Serves one handler at the contract's path and returns a fetch-like function. */
const serve = (handler: EventHandler) => {
  const router = createRouter().post('/api/things/:id', handler);
  const app = createApp().use(router);
  const fetchHandler = toWebHandler(app);
  return async (path: string, body?: string) => {
    const response = await fetchHandler(new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
    expect(json).toMatchObject({ statusCode: 400, code: 'validation_failed' });
    expect((json.issues as { path: string }[]).map(({ path }) => path).sort()).toEqual(['body.name', 'params.id', 'query.dryRun']);
    expect(handler).not.toHaveBeenCalled();
  });

  it('given a malformed JSON body, answers 400 validation_failed', async () => {
    const request = serve(defineContractHandler(thing, vi.fn()));

    expect(await request('/api/things/42', '{not json')).toMatchObject({
      status: 400,
      json: { statusCode: 400, code: 'validation_failed' },
    });
  });

  it('outside production, given a response that does not match its schema, fails with a 500 naming the contract', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const request = serve(defineContractHandler(thing, () => ({ status: 200, body: { id: 42 } as never })));

    const { status, json } = await request('/api/things/42', JSON.stringify({ name: 'Proxy' }));

    expect(status).toBe(500);
    expect(json).toMatchObject({ statusCode: 500, code: 'invalid_response' });
    expect(json.message).toContain('updateThing');
  });

  it('in production, sends the response without validating it', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const request = serve(defineContractHandler(thing, () => ({ status: 200, body: { id: 42 } as never })));

    expect(await request('/api/things/42', JSON.stringify({ name: 'Proxy' }))).toEqual({ status: 200, json: { id: 42 } });
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

  it('answers every error with { statusCode, code, message }', async () => {
    const failing = serve(defineContractHandler(thing, () => {
      throw new Error('database exploded');
    }));
    const invalid = serve(defineContractHandler(thing, vi.fn()));

    const errors = [
      (await failing('/api/things/42', JSON.stringify({ name: 'Proxy' }))).json,
      (await invalid('/api/things/abc', '{}')).json,
    ];
    for (const error of errors) {
      expect(error).toEqual(expect.objectContaining({
        statusCode: expect.any(Number) as number,
        code: expect.any(String) as string,
        message: expect.any(String) as string,
      }));
    }
    // Unexpected errors do not leak their details.
    expect(errors[0]).toMatchObject({ statusCode: 500, code: 'internal_error' });
    expect(JSON.stringify(errors[0])).not.toContain('exploded');
  });
});
