import { describe, expect, it } from 'vitest';

import { workspaceSchema } from './workspace';
import { issuePaths } from '../tests/support/issues';

describe('workspace schema', () => {
  it('requires a name of 1 to 100 characters and a kebab-case slug of up to 48', () => {
    expect(workspaceSchema.parse({ name: ' Demo homelab ', slug: 'demo-homelab' }))
      .toEqual({ name: 'Demo homelab', slug: 'demo-homelab' });
    expect(workspaceSchema.safeParse({ name: 'Demo', slug: 's'.repeat(48) }).success).toBe(true);
    expect(issuePaths(workspaceSchema.safeParse({ name: '', slug: 'demo' }))).toEqual(['name']);
    for (const slug of ['Demo', 'demo homelab', '-demo', 's'.repeat(49), '']) {
      expect(issuePaths(workspaceSchema.safeParse({ name: 'Demo', slug }))).toEqual(['slug']);
    }
  });

  it('accepts nothing but a name and a slug', () => {
    expect(workspaceSchema.safeParse({ name: 'Demo', slug: 'demo' }).success).toBe(true);
    expect(issuePaths(workspaceSchema.safeParse({ name: 'Demo', slug: 'demo', id: 'x' }))).toEqual(['']);
  });
});
