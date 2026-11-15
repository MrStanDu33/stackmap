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
export function issueKey(code: string): string {
  const dot = code.indexOf('.');
  if (dot === -1) {
    return `issues.${code}`;
  }
  const [owner, rule] = [code.slice(0, dot), code.slice(dot + 1)];
  // `common.*` codes come from the SDK's common fields, which the app translates.
  return owner === 'common' ? `issues.common.${rule}` : `extensions.${owner}.issues.${rule}`;
}

/** The issue in the interface's language, or its English message when its code has no translation. */
export function issueMessage(
  { code, params, message }: Issue,
  { t, te }: { t: Translate; te: (key: string) => boolean },
): string {
  // An invalid value says what was expected, by its format (an IPv4 address, a CIDR…), when the app knows it.
  const format = code === 'common.invalid-value' ? `issues.format.${String(params?.format)}` : '';
  const key = format && te(format) ? format : issueKey(code ?? 'custom');
  return te(key) ? t(key, params ?? {}) : message;
}
