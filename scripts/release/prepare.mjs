// Maintainer: `pnpm release:prepare [version]` on an up-to-date develop. Opens the release PR into develop with the
// version bump and the changelog, as a signed commit. After it is merged, open develop → main with the same title.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { buildChangelogSection, nextVersion, prependSection } from './changelog.mjs';

const run = (command, args) => execFileSync(command, args, { encoding: 'utf8' }).trim();
const fail = (message) => {
  console.error(`✖ ${message}`);
  process.exit(1);
};

if (run('git', ['branch', '--show-current']) !== 'develop') {
  fail('Run this on develop.');
}
if (run('git', ['status', '--porcelain']) !== '') {
  fail('The working tree is not clean.');
}
run('git', ['fetch', 'origin', 'develop', '--tags']);
if (run('git', ['rev-parse', 'HEAD']) !== run('git', ['rev-parse', 'origin/develop'])) {
  fail('develop is not up to date with origin/develop.');
}

const lastTag = (() => {
  try {
    return run('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*']);
  } catch {
    return null;
  }
})();
const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
const subjects = run('git', ['log', '--first-parent', '--format=%s', range]).split('\n').filter(Boolean);
if (subjects.length === 0) {
  fail(`Nothing to release since ${lastTag}.`);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = process.argv[2] ?? nextVersion(pkg.version, subjects);
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  fail(`"${version}" is not a x.y.z version.`);
}
const title = `🔖 Release v${version}`;
const branch = `chore-release-${version}`;
const section = buildChangelogSection({ version, date: new Date().toISOString().slice(0, 10), subjects });

run('git', ['switch', '-c', branch]);
writeFileSync('package.json', `${JSON.stringify({ ...pkg, version }, null, 2)}\n`);
const changelog = existsSync('CHANGELOG.md') ? readFileSync('CHANGELOG.md', 'utf8') : '';
writeFileSync('CHANGELOG.md', prependSection(changelog, section));
run('git', ['add', 'package.json', 'CHANGELOG.md']);
run('git', ['commit', '-m', title]);
run('git', ['push', '-u', 'origin', branch]);
console.log(run('gh', ['pr', 'create', '--base', 'develop', '--title', title, '--body', section]));
