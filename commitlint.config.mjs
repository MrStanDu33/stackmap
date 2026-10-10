import { checkCommitMessage } from './scripts/conventions/commit-rule.mjs';

/** @type {import('@commitlint/types').UserConfig} */
export default {
  // CI applies the same rule without exceptions, so commitlint must not skip anything locally.
  defaultIgnores: false,
  plugins: [{
    rules: {
      'stackmap-commit': ({ raw }) => {
        const { valid, errors } = checkCommitMessage(raw ?? '');
        return [valid, errors.join('\n')];
      },
    },
  }],
  rules: {
    'stackmap-commit': [2, 'always'],
  },
};
