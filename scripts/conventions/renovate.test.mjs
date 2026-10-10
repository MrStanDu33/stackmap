import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkBranchName } from './branch-rule.mjs';
import { checkCommitMessage } from './commit-rule.mjs';

const renovate = JSON.parse(readFileSync(join(import.meta.dirname, '../../.github/renovate.json'), 'utf8'));

describe('Renovate configuration (.github/renovate.json)', () => {
  it('targets develop', () => {
    expect(renovate.baseBranchPatterns).toEqual(['develop']);
  });

  // Renovate builds branch names as branchPrefix + branchTopic (depNameSanitized-major.x, group slugs…).
  it.each([
    'nuxt-ui-5.x',
    'types-node-25.x',
    'actions-checkout-8.x',
    'vitest-monorepo',
    'non-major',
    'lock-file-maintenance',
    'pin-dependencies',
  ])('produces a valid branch name for the topic %s', (topic) => {
    expect(checkBranchName(`${renovate.branchPrefix}${topic}`)).toEqual({ valid: true, errors: [] });
  });

  it.each([
    'Update dependency @nuxt/ui to v4.12.0',
    'Update dependency typescript-eslint to v9',
    'Update non-major dependencies',
    'Update actions/checkout action to v8',
    'Lock file maintenance',
    'Pin dependencies',
  ])('produces a commit and PR title that follows the convention: %s', (message) => {
    expect(checkCommitMessage(`${renovate.commitMessagePrefix} ${message}`)).toEqual({ valid: true, errors: [] });
  });
});
