/** Whether a database error is a unique constraint violation, on SQLite or Postgres. */
export function isUniqueViolation(_error: unknown): boolean {
  throw new Error('Not implemented');
}

/** Whether a database error is a foreign key violation, on SQLite or Postgres. */
export function isForeignKeyViolation(_error: unknown): boolean {
  throw new Error('Not implemented');
}
