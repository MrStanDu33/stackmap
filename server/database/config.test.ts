import { describe, expect, it } from 'vitest';

import { resolveDatabaseConfig } from './config';

describe('database configuration', () => {
  it('given no DATABASE_URL, uses SQLite at <DATA_DIR>/stackmap.sqlite with DATA_DIR defaulting to ./data', () => {
    expect(resolveDatabaseConfig({})).toEqual({ dialect: 'sqlite', path: 'data/stackmap.sqlite' });
    expect(resolveDatabaseConfig({ DATA_DIR: '/data' })).toEqual({ dialect: 'sqlite', path: '/data/stackmap.sqlite' });
  });

  it('given an empty DATA_DIR, falls back to ./data', () => {
    expect(resolveDatabaseConfig({ DATABASE_URL: '', DATA_DIR: '' }))
      .toEqual({ dialect: 'sqlite', path: 'data/stackmap.sqlite' });
  });

  it('given DATABASE_URL=file:<path>, uses SQLite at that path', () => {
    expect(resolveDatabaseConfig({ DATABASE_URL: 'file:/srv/stackmap/db.sqlite' }))
      .toEqual({ dialect: 'sqlite', path: '/srv/stackmap/db.sqlite' });
  });

  it('given a plain file path, uses SQLite at that path', () => {
    expect(resolveDatabaseConfig({ DATABASE_URL: './local/stackmap.sqlite' }))
      .toEqual({ dialect: 'sqlite', path: './local/stackmap.sqlite' });
  });

  it('given DATABASE_URL=:memory:, uses an in-memory SQLite database', () => {
    expect(resolveDatabaseConfig({ DATABASE_URL: ':memory:' })).toEqual({ dialect: 'sqlite', path: ':memory:' });
  });

  it.each([
    'postgres://stackmap:secret@db:5432/stackmap',
    'postgresql://stackmap:secret@db:5432/stackmap',
  ])('given a postgres:// or postgresql:// URL, uses Postgres with that URL (%s)', (url) => {
    expect(resolveDatabaseConfig({ DATABASE_URL: url })).toEqual({ dialect: 'postgres', url });
  });

  it('given any other DATABASE_URL, fails with an error listing the accepted forms', () => {
    expect(() => resolveDatabaseConfig({ DATABASE_URL: 'mysql://root@db/stackmap' }))
      .toThrow(/file:<path>.*postgres:\/\//s);
  });

  it('never prints the password of a DATABASE_URL in an error', () => {
    const resolving = () => resolveDatabaseConfig({ DATABASE_URL: 'mysql://root:hunter2@db/stackmap' });

    // The URL is still recognizable, with the password masked.
    expect(resolving).toThrow(/mysql:\/\/root:\*+@db/);
    expect(resolving).toThrow(expect.objectContaining({ message: expect.not.stringContaining('hunter2') as string }));
  });
});
