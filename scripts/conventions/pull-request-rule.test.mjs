import { describe, expect, it } from 'vitest';

import { checkPullRequest } from './pull-request-rule.mjs';

describe('pull request rule', () => {
  describe('given a work branch targeting develop', () => {
    it('accepts a title that follows the commit convention', () => {
      expect(checkPullRequest({ title: '✨ Add graph filters', head: 'feature-graph-filters', base: 'develop' }))
        .toEqual({ valid: true, errors: [] });
    });

    it('rejects a title that breaks the commit convention, because it becomes the squash commit', () => {
      const result = checkPullRequest({ title: 'Graph filters', head: 'feature-graph-filters', base: 'develop' });
      expect(result.valid).toBe(false);
      expect(result.errors.join('\n')).toMatch(/title.*gitmoji/i);
    });

    it('rejects a badly named branch', () => {
      const result = checkPullRequest({ title: '✨ Add graph filters', head: 'graph-filters', base: 'develop' });
      expect(result.errors.join('\n')).toMatch(/feature-<slug>/);
    });
  });

  describe('given a pull request targeting main', () => {
    it('accepts a release from develop titled "🔖 Release vX.Y.Z"', () => {
      expect(checkPullRequest({ title: '🔖 Release v0.2.0', head: 'develop', base: 'main' }))
        .toEqual({ valid: true, errors: [] });
    });

    it('rejects a release from develop with another title', () => {
      const result = checkPullRequest({ title: '✨ Add graph filters', head: 'develop', base: 'main' });
      expect(result.valid).toBe(false);
      expect(result.errors.join('\n')).toMatch(/🔖 Release vX\.Y\.Z/);
    });

    it('rejects a work branch', () => {
      const result = checkPullRequest({ title: '🔖 Release v0.2.0', head: 'feature-graph-filters', base: 'main' });
      expect(result.errors.join('\n')).toMatch(/must target develop/);
    });
  });

  it('reports every problem at once', () => {
    const result = checkPullRequest({ title: 'wip', head: 'my-branch', base: 'main' });
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
