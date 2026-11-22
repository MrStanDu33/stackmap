// Nightly (flake-hunt.yml): runs the story suite again and again, shuffled and overloaded, and names each flaky story.
// Usage: pnpm test:stories:hunt [runs]
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { hunt } from './flake-hunt.mjs';

const dir = mkdtempSync(join(tmpdir(), 'flake-hunt-'));
const report = join(dir, 'report.json');

/** @param {import('./flake-hunt.mjs').HuntRun} hunted */
const run = ({ args, env }) => {
  rmSync(report, { force: true });
  spawnSync('pnpm', ['exec', ...args, '--reporter=default', '--reporter=json', `--outputFile.json=${report}`], {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (!existsSync(report)) {
    return Promise.resolve(['the run itself: it ended without a report']);
  }
  /** @type {{ testResults: { name: string, assertionResults: { status: string, fullName: string }[] }[] }} */
  const { testResults } = JSON.parse(readFileSync(report, 'utf8'));
  return Promise.resolve(testResults.flatMap(({ name, assertionResults }) => assertionResults
    .filter(({ status }) => status === 'failed')
    .map(({ fullName }) => `${relative(process.cwd(), name)} > ${fullName}`)));
};

const runs = process.argv[2] ? Number(process.argv[2]) : undefined;
const code = await hunt({ runs, run, log: (line) => console.log(line) });
rmSync(dir, { recursive: true, force: true });
process.exit(code);
