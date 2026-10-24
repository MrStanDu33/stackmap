import { describe, expect, it } from 'vitest';

import { siteSchema } from './site';
import { issuePaths } from '../../../tests/support/issues';

describe('site schema', () => {
  it('requires a name of 1 to 100 characters', () => {
    expect(siteSchema.input.parse({ name: '  Home lab ' }).name).toBe('Home lab');
    expect(siteSchema.input.safeParse({ name: 'n'.repeat(100) }).success).toBe(true);
    for (const name of [undefined, '', '   ', 'n'.repeat(101)]) {
      expect(issuePaths(siteSchema.input.safeParse({ name }))).toEqual(['name']);
    }
  });
});
