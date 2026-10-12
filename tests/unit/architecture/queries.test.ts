import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import config from '../../../vitest.config';

const ROOT = join(import.meta.dirname, '../../..');

/** Where queries may be written: the workspace-scoped repositories and the database layer. */
const QUERY_LAYER = /^server\/(?:repositories|database)\//;
const QUERY = /\.(?:selectFrom|insertInto|replaceInto|updateTable|deleteFrom|mergeInto)\(/;
const SQL_TAG = /import\s*\{[^}]*\bsql\b[^}]*\}\s*from\s*'kysely'/;
const SELECT_ALL = /\.selectAll\(/;

const sources = globSync('server/**/*.ts', { cwd: ROOT }).filter((file) => !file.endsWith('.test.ts'));
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');
const matching = (pattern: RegExp, files: string[]) => files.filter((file) => pattern.test(read(file)));

describe('database access', () => {
  it('queries the database (selectFrom, insertInto, updateTable, deleteFrom, the sql tag) only in server/repositories and server/database', () => {
    expect(QUERY.test('db.selectFrom(\'host\')')).toBe(true);
    expect(SQL_TAG.test('import { Kysely, sql } from \'kysely\';')).toBe(true);
    expect(sources.length).toBeGreaterThan(10);

    const outside = sources.filter((file) => !QUERY_LAYER.test(file));

    expect(matching(QUERY, outside)).toEqual([]);
    expect(matching(SQL_TAG, outside)).toEqual([]);
  });

  it('never selects every column (selectAll)', () => {
    expect(SELECT_ALL.test('db.selectFrom(\'host\').selectAll()')).toBe(true);

    expect(matching(SELECT_ALL, sources)).toEqual([]);
  });
});

describe('coverage', () => {
  it('requires 90% coverage of the repositories and the entity schemas', () => {
    const thresholds = (config.test?.coverage as { thresholds?: Record<string, unknown> } | undefined)?.thresholds;
    const strict = { lines: 90, functions: 90, branches: 90, statements: 90 };

    expect(thresholds?.['server/repositories/**']).toEqual(strict);
    expect(thresholds?.['shared/entities/**']).toEqual(strict);
  });
});
