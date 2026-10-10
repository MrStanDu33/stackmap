import { checkPullRequestTarget } from './branch-rule.mjs';
import { checkCommitMessage } from './commit-rule.mjs';

const RELEASE_TITLE = /^🔖 Release v\d+\.\d+\.\d+$/u;

/**
 * Checks a pull request: its title becomes the squash commit, and only releases go into main.
 *
 * @param {{ title: string, head: string, base: string }} pullRequest
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const checkPullRequest = ({ title, head, base }) => {
  const errors = [
    ...checkCommitMessage(title).errors.map((error) => `Pull request title: ${error}`),
    ...checkPullRequestTarget(head, base).errors,
  ];
  if (base === 'main' && !RELEASE_TITLE.test(title)) {
    errors.push('A pull request into main is a release and must be titled "🔖 Release vX.Y.Z".');
  }
  return { valid: errors.length === 0, errors };
};
