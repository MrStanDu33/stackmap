// Claude Code PreToolUse hook (Edit/Write): blocks source edits that have no test yet. Exit code 2 blocks the edit
// and shows the reason to the agent.
import { existsSync, globSync, readFileSync } from 'node:fs';
import { basename, relative, sep } from 'node:path';
import { text } from 'node:stream/consumers';

import { checkSourceEdit } from './tdd-guard-rule.mjs';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const input = JSON.parse(await text(process.stdin));
const filePath = input.tool_input?.file_path;
if (!filePath) {
  process.exit(0);
}

const path = relative(root, filePath).split(sep).join('/');
const stem = basename(path).replace(/\.[^.]+$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// An import statement or a dynamic import whose specifier ends with the file name, e.g. `from '../domain/trace'`.
const importsIt = new RegExp(String.raw`(?:from\s+|import\s*\(\s*)['"][^'"]*/${stem}(?:\.(?:vue|[cm]?[jt]s))?['"]`);

const testsImporting = globSync('**/*.{test,spec,stories}.{ts,mts,mjs,js}', {
  cwd: root,
  exclude: (entry) => entry === 'node_modules' || entry.startsWith('.'),
}).filter((test) => importsIt.test(readFileSync(`${root}/${test}`, 'utf8')));

const result = checkSourceEdit({ path, exists: (file) => existsSync(`${root}/${file}`), testsImporting });
if (!result.allowed) {
  console.error(result.reason);
  process.exit(2);
}
