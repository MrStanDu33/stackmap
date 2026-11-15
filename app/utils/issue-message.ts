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
  const values = params ?? {};
  // An invalid value says what was expected, by its format (an IPv4 address, a CIDR…), when the app knows it.
  const format = code === 'common.invalid-value' ? `issues.format.${String(values.format)}` : '';
  // A length, a count or a number: too_small and too_big read by what was checked.
  const sized = code === 'too_small' || code === 'too_big' ? `issues.${code}_${String(values.origin)}` : '';
  const key = [format, sized].find((candidate) => candidate && te(candidate)) ?? issueKey(code ?? 'custom');
  if (!te(key)) {
    return message;
  }
  // The expected type in words, not Zod's id (string, number…).
  const type = `issues.types.${String(values.expected)}`;
  return code === 'invalid_type' && te(type) ? t(key, { ...values, expected: t(type) }) : t(key, values);
}
