/*
 * Constraint violations, recognized by the error codes of both drivers: better-sqlite3 (`SQLITE_CONSTRAINT_*`) and
 * pg (SQLSTATE). Repositories turn them into conflict and in-use errors, so a race between two requests gets the same
 * answer as two requests one after the other.
 */

const UNIQUE_VIOLATIONS = new Set(['SQLITE_CONSTRAINT_UNIQUE', 'SQLITE_CONSTRAINT_PRIMARYKEY', '23505']);
const FOREIGN_KEY_VIOLATIONS = new Set(['SQLITE_CONSTRAINT_FOREIGNKEY', '23503']);

const codeOf = (error: unknown): unknown => (error instanceof Error && 'code' in error ? error.code : undefined);

/** Whether a database error is a unique constraint violation, on SQLite or Postgres. */
export function isUniqueViolation(error: unknown): boolean {
  return UNIQUE_VIOLATIONS.has(codeOf(error) as string);
}

/** Whether a database error is a foreign key violation, on SQLite or Postgres. */
export function isForeignKeyViolation(error: unknown): boolean {
  return FOREIGN_KEY_VIOLATIONS.has(codeOf(error) as string);
}
