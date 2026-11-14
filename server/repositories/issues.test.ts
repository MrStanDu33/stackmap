import { defineEntitySchema, entityName, line } from '@stackmap/extension-sdk/entities';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { toIssues } from './issues';

const issuesOf = (schema: z.ZodType, value: unknown) => {
  const result = schema.safeParse(value);
  if (result.success) {
    throw new Error('Expected the parse to fail');
  }
  return toIssues(result.error.issues);
};

describe('entity validation issue codes', () => {
  it('carries the Zod code and params of a built-in failure (25)', () => {
    const schema = z.strictObject({ name: entityName(), os: line(5).nullable(), port: z.number().int().min(1) });

    expect(issuesOf(schema, { name: '', os: 'Debian 13', port: 0, extra: true })).toEqual([
      { path: 'name', code: 'too_small', params: { minimum: 1, origin: 'string' }, message: expect.any(String) as string },
      { path: 'os', code: 'too_big', params: { maximum: 5, origin: 'string' }, message: expect.any(String) as string },
      { path: 'port', code: 'too_small', params: { minimum: 1, origin: 'number' }, message: expect.any(String) as string },
      { path: '', code: 'unrecognized_keys', params: { keys: 'extra' }, message: expect.any(String) as string },
    ]);
    expect(issuesOf(schema, { name: 3, os: null, port: 1 })[0]).toMatchObject({
      path: 'name', code: 'invalid_type', params: { expected: 'string' },
    });
  });

  it('carries the stable code and values an entity\'s custom check declares, with the English message as fallback (26)', () => {
    const schema = defineEntitySchema<{ name: string }, { name: string }>({ name: entityName() }, (value, context) => {
      context.addIssue({
        code: 'custom', path: ['name'], message: `${value.name} is reserved`, params: { code: 'test.reserved', name: value.name },
      });
      return value;
    });

    expect(issuesOf(schema.input, { name: 'localhost' })).toEqual([
      { path: 'name', code: 'test.reserved', params: { name: 'localhost' }, message: 'localhost is reserved' },
    ]);
  });

  it('gives an unknown kind the code unknown-kind with the entity and the kind (27)', () => {
    // The repository's kind check builds its issue with this helper.
    expect(toIssues([], { unknownKind: { path: 'kind', entity: 'host', kind: 'mainframe' } })).toEqual([{
      path: 'kind',
      code: 'unknown-kind',
      params: { entity: 'host', kind: 'mainframe' },
      message: 'No active extension provides the host kind "mainframe"',
    }]);
  });
});
