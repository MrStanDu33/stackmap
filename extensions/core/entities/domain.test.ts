import { describe, expect, it } from 'vitest';

import { domainSchema } from './domain';
import { issuePaths } from '../../../tests/support/issues';

describe('domain schema', () => {
  it('requires a DNS name with at least two labels, normalized', () => {
    expect(domainSchema.input.parse({ name: 'HomeLab.Example.' }).name).toBe('homelab.example');
    for (const name of ['localhost', 'café.example', '', undefined]) {
      expect(issuePaths(domainSchema.input.safeParse({ name }))).toEqual(['name']);
    }
  });
});
