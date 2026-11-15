import type { Translate } from './traffic-graph';
import type { ProblemIssue } from '../../shared/contracts/errors';
import type { z } from 'zod';

export type Issue = z.infer<typeof ProblemIssue>;

/** The Zod codes an entity's schema can raise, each translated as `issues.<code>`. */
export const ZOD_ISSUE_CODES = [
  'invalid_type', 'too_big', 'too_small', 'invalid_format', 'not_multiple_of', 'unrecognized_keys', 'invalid_value',
  'invalid_union', 'invalid_key', 'invalid_element', 'custom',
] as const;

/** The i18n key of an issue code: `issues.<code>`, `issues.common.<rule>` or `extensions.<id>.issues.<rule>`. */
export function issueKey(_code: string): string {
  throw new Error('Not implemented');
}

/** The issue in the interface's language, or its English message when its code has no translation. */
export function issueMessage(_issue: Issue, _i18n: { t: Translate; te: (key: string) => boolean }): string {
  throw new Error('Not implemented');
}
