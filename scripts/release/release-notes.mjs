// CI: prints the CHANGELOG.md section of a version, e.g. `node release-notes.mjs 0.2.0`.
import { readFileSync } from 'node:fs';

import { extractReleaseNotes } from './changelog.mjs';

const [version] = process.argv.slice(2);
process.stdout.write(`${extractReleaseNotes(readFileSync('CHANGELOG.md', 'utf8'), version)}\n`);
