/** main, develop, or feature-/fix-/chore- followed by a kebab-case slug (dots allowed for versions). */
export const BRANCH_PATTERN = /^(main|develop|(feature|fix|chore)-[a-z0-9]+([.-][a-z0-9]+)*)$/;

const WORK_BRANCH = /^(feature|fix|chore)-/;

const PROTECTED_BRANCHES = new Set(['main', 'develop']);

const NAME_HINT = 'Use feature-<slug>, fix-<slug> or chore-<slug> with a lowercase kebab-case slug,'
  + ' e.g. feature-42-graph-filters.';

/**
 * @param {string} name
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const checkBranchName = (name) => (BRANCH_PATTERN.test(name)
  ? { valid: true, errors: [] }
  : { valid: false, errors: [`"${name}" is not a valid branch name. ${NAME_HINT}`] });

/**
 * Work branches merge into develop; only develop merges into main.
 *
 * @param {string} source
 * @param {string} target
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const checkPullRequestTarget = (source, target) => {
  const nameCheck = checkBranchName(source);
  if (!nameCheck.valid) {
    return nameCheck;
  }
  if (WORK_BRANCH.test(source)) {
    return target === 'develop'
      ? { valid: true, errors: [] }
      : { valid: false, errors: [`${source} must target develop, not ${target}.`] };
  }
  return source === 'develop' && target === 'main'
    ? { valid: true, errors: [] }
    : { valid: false, errors: [`Only develop can be merged into main (got ${source} → ${target}).`] };
};

/**
 * @param {string} name
 * @returns {boolean} Whether direct pushes to this branch are blocked.
 */
export const isProtectedBranch = (name) => PROTECTED_BRANCHES.has(name);

const BRANCH_REF = 'refs/heads/';
const DELETED_SHA = /^0+$/;

const checkPushedRef = (line) => {
  const [, localSha = '', remoteRef = ''] = line.trim().split(/\s+/);
  if (!remoteRef.startsWith(BRANCH_REF)) {
    return [];
  }
  const branch = remoteRef.slice(BRANCH_REF.length);
  if (isProtectedBranch(branch)) {
    return [`Direct pushes to ${branch} are blocked. Open a pull request instead.`];
  }
  if (DELETED_SHA.test(localSha)) {
    return [];
  }
  return checkBranchName(branch).errors;
};

/**
 * Checks the "<local ref> <local sha> <remote ref> <remote sha>" lines git passes to the pre-push hook.
 *
 * @param {string} stdin
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const checkPushedRefs = (stdin) => {
  const errors = stdin
    .split('\n')
    .filter((line) => line.trim() !== '')
    .flatMap(checkPushedRef);
  return { valid: errors.length === 0, errors };
};
