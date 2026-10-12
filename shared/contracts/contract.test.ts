import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineContract } from './contract';

const valid = () => ({
  method: 'get' as const,
  path: '/api/things/:id' as const,
  operationId: 'getThing',
  summary: 'Get a thing',
  description: 'Gets one thing by its id.',
  tags: ['Things'],
  requiredRole: 'viewer' as const,
  params: z.object({ id: z.string() }),
  query: z.object({ expand: z.boolean().optional() }),
  responses: {
    200: {
      description: 'The thing',
      schema: z.object({ id: z.string() }),
      examples: { thing: { summary: 'A thing', value: { id: '42' } } },
    },
  },
});

describe('defineContract', () => {
  it('returns the contract unchanged: method, path, operationId, summary, tags, requiredRole, inputs and responses', () => {
    const contract = valid();
    expect(defineContract(contract)).toBe(contract);
  });

  it('given a contract without a summary, fails at definition time', () => {
    expect(() => defineContract({ ...valid(), summary: ' ' })).toThrow(/getThing.*summary/);
  });

  it('given a contract without a tag, fails at definition time', () => {
    expect(() => defineContract({ ...valid(), tags: [] })).toThrow(/getThing.*tag/);
  });

  it('given a contract without a response, fails at definition time', () => {
    expect(() => defineContract({ ...valid(), responses: {} })).toThrow(/getThing.*response/);
  });
});

describe('defineContract: documentation', () => {
  it('given a contract without a description, fails at definition time', () => {
    const { description: _description, ...undescribed } = valid();

    expect(() => defineContract({ ...valid(), description: ' ' })).toThrow(/getThing.*description/);
    expect(() => defineContract(undescribed as Parameters<typeof defineContract>[0])).toThrow(/getThing.*description/);
  });

  it('given a response without an example, fails at definition time naming the status', () => {
    const response = { description: 'The thing', schema: z.object({ id: z.string() }) };

    expect(() => defineContract({ ...valid(), responses: { 200: { ...response, examples: {} } } }))
      .toThrow(/getThing.*example.*200/);
    expect(() => defineContract({ ...valid(), responses: { 200: response } }))
      .toThrow(/getThing.*example.*200/);
  });
});
