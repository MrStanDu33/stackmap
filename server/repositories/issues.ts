import { ISSUE_LIMITS } from '../../shared/contracts/errors';

import type { z } from 'zod';

/** One invalid value, with a stable code and params the interface translates, and the English message as fallback. */
export interface CodedIssue {
  path: string;
  code: string;
  params: Record<string, string | number>;
  message: string;
}

/** Issues the repository adds itself. */
export interface ExtraIssues {
  unknownKind?: { path: string; entity: string; kind: string };
}

type Param = string | number;

const param = (value: unknown): Param => (typeof value === 'number' ? value : String(value));

/** The params of each Zod built-in code a translation needs; the rest of the issue is Zod's internals. */
function zodParams(issue: z.core.$ZodIssue): Record<string, Param> {
  switch (issue.code) {
    case 'too_small':
      return { minimum: param(issue.minimum), origin: issue.origin };
    case 'too_big':
      return { maximum: param(issue.maximum), origin: issue.origin };
    case 'invalid_type':
      return { expected: issue.expected };
    case 'invalid_format':
      return { format: issue.format };
    case 'invalid_value':
      return { values: issue.values.map(String).join(', ') };
    case 'unrecognized_keys':
      return { keys: issue.keys.join(', ') };
    case 'not_multiple_of':
      return { divisor: param(issue.divisor) };
    default:
      return {};
  }
}

/** A custom issue's code and values come from its params: `{ code: 'core.duplicate-address', address }`. */
function customCode(issue: z.core.$ZodIssueCustom): { code: string; params: Record<string, Param> } {
  const { code, ...params } = (issue.params ?? {}) as Record<string, unknown>;
  return {
    code: typeof code === 'string' ? code : 'custom',
    params: Object.fromEntries(Object.entries(params).map(([key, value]) => [key, param(value)])),
  };
}

/** Cut to the maximum, without splitting a surrogate pair, and marked as cut. */
function clip(value: string, maximum: number): string {
  return value.length <= maximum ? value : `${value.slice(0, maximum - 1).replace(/[\uD800-\uDBFF]$/, '')}…`;
}

/** The issue within the bounds a Problem declares: a longer one would echo the input back, or fail its contract. */
export function boundIssue({ path, code, params, message }: CodedIssue): CodedIssue {
  return {
    path: clip(path, ISSUE_LIMITS.path),
    code,
    params: Object.fromEntries(Object.entries(params).slice(0, ISSUE_LIMITS.params)
      .map(([key, value]) => [key, typeof value === 'string' ? clip(value, ISSUE_LIMITS.param) : value])),
    message: clip(message, ISSUE_LIMITS.message),
  };
}

/** The coded issues of a failed parse, and of the repository's own checks, within a Problem's bounds. */
export function toIssues(issues: readonly z.core.$ZodIssue[], extra: ExtraIssues = {}): CodedIssue[] {
  const coded = issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    ...(issue.code === 'custom' ? customCode(issue) : { code: issue.code, params: zodParams(issue) }),
    message: issue.message,
  }));
  if (extra.unknownKind) {
    const { path, entity, kind } = extra.unknownKind;
    coded.push({
      path, code: 'unknown-kind', params: { entity, kind }, message: `No active extension provides the ${entity} kind "${kind}"`,
    });
  }
  return coded.map(boundIssue);
}
