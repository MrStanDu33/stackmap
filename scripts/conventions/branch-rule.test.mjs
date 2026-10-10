import { describe, expect, it } from 'vitest';

import { checkBranchName, checkPullRequestTarget, checkPushedRefs, isProtectedBranch } from './branch-rule.mjs';

const SHA = 'a'.repeat(40);
const ZERO = '0'.repeat(40);
const pushLine = (remoteRef, localSha = SHA) => `refs/heads/local ${localSha} ${remoteRef} ${ZERO}`;

describe('branch rule', () => {
  describe('given a branch name', () => {
    it.each([
      'main',
      'develop',
      'feature-graph-filters',
      'feature-42-graph-filters',
      'fix-trace-nat-hops',
      'chore-deps-nuxt-ui-4.x',
      'chore-release-0.2.0',
    ])('accepts %s', (name) => {
      expect(checkBranchName(name)).toEqual({ valid: true, errors: [] });
    });

    it.each([
      'my-branch',
      'feature/graph-filters',
      'feature-Graph-filters',
      'feature-graph_filters',
      'feature-',
      'feature--graph',
      'feature-graph-',
      'hotfix-trace',
      'renovate/nuxt-monorepo',
      '',
    ])('rejects %j', (name) => {
      const result = checkBranchName(name);
      expect(result.valid).toBe(false);
      expect(result.errors.join('\n')).toMatch(/feature-<slug>/);
    });
  });

  describe('given a pull request source and target', () => {
    it.each([
      ['feature-graph-filters', 'develop'],
      ['fix-trace-nat-hops', 'develop'],
      ['chore-deps-nuxt-ui-4.x', 'develop'],
      ['develop', 'main'],
    ])('accepts %s → %s', (source, target) => {
      expect(checkPullRequestTarget(source, target)).toEqual({ valid: true, errors: [] });
    });

    it.each([
      ['feature-graph-filters', 'main', /develop/],
      ['fix-trace-nat-hops', 'main', /develop/],
      ['chore-ci', 'feature-graph-filters', /develop/],
      ['main', 'develop', /develop.*main/],
      ['develop', 'feature-graph-filters', /develop.*main/],
      ['my-branch', 'develop', /feature-<slug>/],
    ])('rejects %s → %s', (source, target, pattern) => {
      const result = checkPullRequestTarget(source, target);
      expect(result.valid).toBe(false);
      expect(result.errors.join('\n')).toMatch(pattern);
    });
  });

  describe('given a branch that receives direct pushes', () => {
    it.each(['main', 'develop'])('treats %s as protected', (name) => {
      expect(isProtectedBranch(name)).toBe(true);
    });

    it('does not protect work branches', () => {
      expect(isProtectedBranch('feature-graph-filters')).toBe(false);
    });
  });

  describe('given the refs that git passes to the pre-push hook', () => {
    it('accepts a push of a valid work branch', () => {
      expect(checkPushedRefs(pushLine('refs/heads/feature-graph-filters'))).toEqual({ valid: true, errors: [] });
    });

    it.each(['main', 'develop'])('blocks a direct push to %s', (branch) => {
      const result = checkPushedRefs(pushLine(`refs/heads/${branch}`));
      expect(result.valid).toBe(false);
      expect(result.errors.join('\n')).toMatch(new RegExp(`${branch}.*pull request`, 'i'));
    });

    it('blocks a push of a badly named branch', () => {
      const result = checkPushedRefs(pushLine('refs/heads/my-branch'));
      expect(result.valid).toBe(false);
      expect(result.errors.join('\n')).toMatch(/feature-<slug>/);
    });

    it('accepts tag pushes', () => {
      expect(checkPushedRefs(pushLine('refs/tags/v0.1.0'))).toEqual({ valid: true, errors: [] });
    });

    it('accepts deleting a remote work branch, whatever its name', () => {
      expect(checkPushedRefs(pushLine('refs/heads/my-old-branch', ZERO))).toEqual({ valid: true, errors: [] });
    });

    it('blocks deleting a protected branch', () => {
      expect(checkPushedRefs(pushLine('refs/heads/main', ZERO)).valid).toBe(false);
    });

    it('reports every invalid ref when several are pushed', () => {
      const result = checkPushedRefs([
        pushLine('refs/heads/main'),
        pushLine('refs/heads/feature-ok'),
        pushLine('refs/heads/bad_name'),
      ].join('\n'));
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it('accepts an empty push', () => {
      expect(checkPushedRefs('')).toEqual({ valid: true, errors: [] });
    });
  });
});
