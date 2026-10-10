// CI: fails when a component has no story next to it.
import { globSync } from 'node:fs';

import { findComponentsWithoutStories } from './story-coverage.mjs';

const files = globSync(['app/components/**/*', 'extensions/*/app/components/**/*']);
const missing = findComponentsWithoutStories(files);
if (missing.length > 0) {
  console.error(`✖ Components without a story:\n${missing.map((file) => `    ${file}`).join('\n')}`);
  process.exit(1);
}
console.log('✔ Every component has a story.');
