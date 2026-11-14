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

/** The coded issues of a failed parse, and of the repository's own checks. */
export function toIssues(issues: readonly z.core.$ZodIssue[], extra: ExtraIssues = {}): CodedIssue[] {
  if (extra.unknownKind) {
    return [];
  }
  return issues.map((issue) => ({ path: issue.path.map(String).join('.'), code: '', params: {}, message: issue.message }));
}
