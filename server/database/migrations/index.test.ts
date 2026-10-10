import { readdirSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { MIGRATIONS } from './index';

const MIGRATION_FILE = /^(\d{4})_[a-z0-9_]+\.ts$/;

const migrationFiles = readdirSync(import.meta.dirname)
  .filter((file) => MIGRATION_FILE.test(file))
  .map((file) => file.replace(/\.ts$/, ''))
  .sort();

describe('migration list', () => {
  it('lists every migration file of the directory explicitly, so the production bundle contains them', () => {
    expect(migrationFiles.length).toBeGreaterThan(0);
    expect(Object.keys(MIGRATIONS)).toEqual(migrationFiles);
  });

  it('names migrations with a 4-digit sequence prefix, in ascending order without gaps', () => {
    const sequence = Object.keys(MIGRATIONS).map((name) => Number(name.slice(0, 4)));
    expect(sequence).not.toHaveLength(0);
    expect(sequence).toEqual(sequence.map((_, index) => index + 1));
  });

  it('gives every migration both an up and a down', () => {
    expect(Object.keys(MIGRATIONS)).not.toHaveLength(0);
    const incomplete = Object.entries(MIGRATIONS)
      .filter(([, migration]) => typeof migration.up !== 'function' || typeof migration.down !== 'function')
      .map(([name]) => name);
    expect(incomplete).toEqual([]);
  });
});
