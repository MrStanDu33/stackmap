import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineContract } from './contract';

const valid = () => ({
  method: 'get' as const,
  path: '/api/things/:id' as const,
  operationId: 'getThing',
  summary: 'Get a thing',
  tags: ['Things'],
  requiredRole: 'viewer' as const,
  params: z.object({ id: z.string() }),
  query: z.object({ expand: z.boolean().optional() }),
  responses: { 200: { description: 'The thing', schema: z.object({ id: z.string() }) } },
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
