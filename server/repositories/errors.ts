/*
 * Expected failures of repositories, which routes turn into Problem Details (400, 409, 422). Anything else a
 * repository throws is unexpected.
 */

export interface EntityIssue {
  /** Dotted path of the field: `name`, `addresses.1.address`. */
  path: string;
  message: string;
}

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

  constructor(readonly dependents: Dependent[]) {
    super(`The entity is still used by ${dependents.map(({ entity, count }) => `${String(count)} ${entity}`).join(', ')}.`);
  }
}
