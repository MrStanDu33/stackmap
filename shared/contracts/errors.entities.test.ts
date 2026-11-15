import { describe, expect, it } from 'vitest';

import { PROBLEMS, ProblemIssue } from './errors';

describe('entity problems and issues', () => {
  it('declares entity_type_not_found, entity_not_found, entity_invalid, reference_invalid, entity_conflict, entity_in_use and entity_changed', () => {
    expect(Object.fromEntries(Object.entries(PROBLEMS)
      .filter(([code]) => code.startsWith('entity_') || code === 'reference_invalid')
      .map(([code, { status }]) => [code, status]))).toEqual({
      entity_type_not_found: 404,
      entity_not_found: 404,
      entity_invalid: 422,
      reference_invalid: 422,
      entity_conflict: 409,
      entity_in_use: 409,
      entity_changed: 409,
    });
  });

  it('gives every issue a bounded code and params next to its path and message (18)', () => {
    const issue = { path: 'body.name', message: 'Too big', code: 'too_big', params: { maximum: 100, origin: 'string' } };

    expect(ProblemIssue.parse(issue)).toEqual(issue);
    expect(ProblemIssue.safeParse({ ...issue, code: 'x'.repeat(101) }).success).toBe(false);
    expect(ProblemIssue.safeParse({ ...issue, params: { nested: { no: true } } }).success).toBe(false);
    expect(ProblemIssue.safeParse({
      ...issue, params: Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`p${String(index)}`, index])),
    }).success).toBe(false);
  });
});
