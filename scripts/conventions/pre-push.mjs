// Husky pre-push hook: git passes the pushed refs on stdin.
import { text } from 'node:stream/consumers';

import { checkPushedRefs } from './branch-rule.mjs';

const { valid, errors } = checkPushedRefs(await text(process.stdin));
if (!valid) {
  console.error(errors.map((error) => `✖ ${error}`).join('\n'));
  process.exit(1);
}
