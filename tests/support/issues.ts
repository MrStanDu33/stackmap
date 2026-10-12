import type { z } from 'zod';

/** The paths of a failed parse's issues (`addresses.0.address`), or [] when it succeeded. */
export const issuePaths = (result: z.ZodSafeParseResult<unknown>): string[] =>
  result.success ? [] : result.error.issues.map((issue) => issue.path.map(String).join('.'));

/** The messages of a failed parse's issues. */
export const issueMessages = (result: z.ZodSafeParseResult<unknown>): string[] =>
  result.success ? [] : result.error.issues.map((issue) => issue.message);
