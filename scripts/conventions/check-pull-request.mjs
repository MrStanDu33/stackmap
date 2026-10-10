// CI: checks the pull request title, branch and target. Values come from the environment, never from the shell
// command line, so a crafted title cannot inject commands.
import { checkPullRequest } from './pull-request-rule.mjs';

const { valid, errors } = checkPullRequest({
  title: process.env.PR_TITLE ?? '',
  head: process.env.PR_HEAD ?? '',
  base: process.env.PR_BASE ?? '',
});
if (!valid) {
  console.error(errors.map((error) => `✖ ${error}`).join('\n'));
  process.exit(1);
}
console.log('✔ Pull request title, branch and target follow the conventions.');
