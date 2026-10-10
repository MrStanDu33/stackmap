// Claude Code PostToolUse hook (Edit/Write): fixes lint issues in the edited file. Remaining errors are shown to the
// agent (exit code 2) so it fixes them; the edit itself is kept.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { text } from 'node:stream/consumers';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const input = JSON.parse(await text(process.stdin));
const file = input.tool_input?.file_path;
if (!file || !existsSync(file) || file.includes('/node_modules/')) {
  process.exit(0);
}

const linters = [
  [/\.(?:[cm]?[jt]s|vue)$/, 'eslint'],
  [/\.(?:css|vue)$/, 'stylelint'],
];
const problems = linters
  .filter(([pattern]) => pattern.test(file))
  .map(([, linter]) => spawnSync(`${root}/node_modules/.bin/${linter}`, ['--fix', file], { cwd: root, encoding: 'utf8' }))
  .filter(({ status }) => status !== 0)
  .map(({ stdout, stderr }) => `${stdout}${stderr}`.trim());

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(2);
}
