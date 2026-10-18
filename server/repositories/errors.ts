import type { EntityIssue } from '@stackmap/extension-sdk/entities';
import type { z } from 'zod';

export type { EntityIssue };

/*
 * Expected failures of repositories, which routes turn into Problem Details (400, 409, 422). Anything else a
 * repository throws is unexpected.
 */

/** The input does not match the entity's schema, or names a kind no active extension provides. */
export class EntityValidationError extends Error {
  override name = 'EntityValidationError';

  constructor(readonly issues: EntityIssue[]) {
    super(`Invalid entity: ${issues.map(({ path, message }) => `${path}: ${message}`).join('; ')}`);
  }
}

/** A field refers to an entity that is not in the workspace (in another one, or nowhere). */
export class WorkspaceReferenceError extends Error {
  override name = 'WorkspaceReferenceError';

  constructor(readonly field: string, readonly id: string) {
    super(`${field} refers to ${id}, which is not in this workspace.`);
  }
}

/** Another entity already has these unique values. */
export class EntityConflictError extends Error {
  override name = 'EntityConflictError';

  constructor(readonly fields: string[]) {
    super(`Another entity already has the same ${fields.join(', ')}.`);
  }
}

export interface Dependent {
  /** The table of the referencing rows: `host`, `hostAddress`. */
  entity: string;
  count: number;
}

/** The entity cannot be removed while others refer to it. */
export class EntityInUseError extends Error {
  override name = 'EntityInUseError';

  /** Without dependents when they are unknown: one appeared after they were counted. */
  constructor(readonly dependents: Dependent[]) {
    super(dependents.length === 0
      ? 'The entity is still used by other entities.'
      : `The entity is still used by ${dependents.map(({ entity, count }) => `${String(count)} ${entity}`).join(', ')}.`);
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
