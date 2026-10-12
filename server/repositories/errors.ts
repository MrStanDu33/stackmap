import type { z } from 'zod';

/*
 * Expected failures of repositories, which routes turn into Problem Details (400, 409). Anything else a repository
 * throws is unexpected.
 */

export interface EntityIssue {
  /** Dotted path of the field: `name`, `addresses.1.address`. */
  path: string;
  message: string;
}

/** The input does not match the entity's schema. */
export class EntityValidationError extends Error {
  override name = 'EntityValidationError';

  constructor(readonly issues: EntityIssue[]) {
    super(`Invalid entity: ${issues.map(({ path, message }) => `${path}: ${message}`).join('; ')}`);
  }
}

/** Another entity already has these unique values. */
export class EntityConflictError extends Error {
  override name = 'EntityConflictError';

  constructor(readonly fields: string[]) {
    super(`Another entity already has the same ${fields.join(', ')}.`);
  }
}

/** The parsed value, or an EntityValidationError listing every issue. */
export function parseEntity<T, I>(schema: z.ZodType<T, I>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues.map(({ path, message }) => ({ path: path.map(String).join('.'), message }));
    throw new EntityValidationError(issues);
  }
  return result.data;
}
