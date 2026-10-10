// CI: checks every commit message of a range, e.g. `node check-commits.mjs <base-sha>..<head-sha>`.
import { execFileSync } from 'node:child_process';

import { checkCommitMessage } from './commit-rule.mjs';

const [range] = process.argv.slice(2);
if (!range) {
  console.error('Usage: node scripts/conventions/check-commits.mjs <base>..<head>');
  process.exit(2);
}

const log = execFileSync('git', ['log', '--format=%H%x00%B%x1e', range], { encoding: 'utf8' });
const failures = log
  .split('\x1e')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [sha, message] = entry.split('\0');
    return { sha, ...checkCommitMessage(message) };
  })
  .filter(({ valid }) => !valid);

for (const { sha, errors } of failures) {
  console.error(`✖ ${sha.slice(0, 7)}\n${errors.map((error) => `    ${error}`).join('\n')}`);
}
process.exit(failures.length > 0 ? 1 : 0);
