import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isForeignKeyViolation, isUniqueViolation } from './errors';
import { DIALECTS, openTestDatabase } from '../../tests/support/databases';

import type { Dialect, TestDatabase } from '../../tests/support/databases';

/** The error a statement fails with. */
const failure = async (statement: Promise<unknown>): Promise<unknown> => {
  try {
    await statement;
  } catch (error) {
    return error;
  }
  throw new Error('The statement did not fail.');
};

describe.each(DIALECTS)('database errors on %s', (dialect: Dialect) => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = await openTestDatabase(dialect);
    await sql`create table parent (id text primary key)`.execute(database.db);
    await sql`create table child (id text primary key, "parentId" text references parent (id))`.execute(database.db);
    await sql`insert into parent (id) values ('p1')`.execute(database.db);
  });

  afterEach(async () => {
    await database.cleanup();
  });

  it('recognizes a unique constraint violation', async () => {
    const error = await failure(sql`insert into parent (id) values ('p1')`.execute(database.db));

    expect(isUniqueViolation(error)).toBe(true);
    expect(isForeignKeyViolation(error)).toBe(false);
  });

  it('recognizes a foreign key violation', async () => {
    const error = await failure(sql`insert into child (id, "parentId") values ('c1', 'missing')`.execute(database.db));

    expect(isForeignKeyViolation(error)).toBe(true);
    expect(isUniqueViolation(error)).toBe(false);
  });

  it('recognizes neither in other errors', async () => {
    const error = await failure(sql`select * from nowhere`.execute(database.db));

    for (const other of [error, new Error('unique constraint'), 'SQLITE_CONSTRAINT_UNIQUE', { code: '23505' }, undefined]) {
      expect(isUniqueViolation(other)).toBe(false);
      expect(isForeignKeyViolation(other)).toBe(false);
    }
  });
});
