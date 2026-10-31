import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadAuthSecret } from './secret';

const dataDir = () => mkdtemp(join(tmpdir(), 'stackmap-secret-'));

describe('auth secret', () => {
  it('given no BETTER_AUTH_SECRET and no file, writes a 32-byte random secret with mode 0600 and reuses it after a restart (22)', async () => {
    const dir = await dataDir();

    const first = await loadAuthSecret({ env: {}, dataDir: dir });
    const again = await loadAuthSecret({ env: {}, dataDir: dir });
    const other = await loadAuthSecret({ env: {}, dataDir: await dataDir() });

    expect(Buffer.from(first, 'base64url')).toHaveLength(32);
    expect(again).toBe(first);
    expect(other).not.toBe(first);
    expect((await readFile(join(dir, '.auth-secret'), 'utf8')).trim()).toBe(first);
    expect((await stat(join(dir, '.auth-secret'))).mode & 0o777).toBe(0o600);
  });

  it('keeps the file the Docker image used, .auth-secret, so existing volumes keep their sessions', async () => {
    const dir = await dataDir();
    await writeFile(join(dir, '.auth-secret'), 'a-secret-from-an-earlier-version-0123456789\n');

    expect(await loadAuthSecret({ env: {}, dataDir: dir })).toBe('a-secret-from-an-earlier-version-0123456789');
  });

  it('given an empty secret file, as after a crash while writing it, writes a new secret', async () => {
    const dir = await dataDir();
    await writeFile(join(dir, '.auth-secret'), ' \n');

    const secret = await loadAuthSecret({ env: {}, dataDir: dir });

    expect(Buffer.from(secret, 'base64url')).toHaveLength(32);
    expect((await readFile(join(dir, '.auth-secret'), 'utf8')).trim()).toBe(secret);
  });

  it('given a BETTER_AUTH_SECRET or a file under 32 characters, refuses it with an error naming the variable', async () => {
    await expect(loadAuthSecret({ env: { BETTER_AUTH_SECRET: 'short' }, dataDir: await dataDir() }))
      .rejects.toThrow(/BETTER_AUTH_SECRET.*32/);
    const dir = await dataDir();
    await writeFile(join(dir, '.auth-secret'), 'short\n');
    await expect(loadAuthSecret({ env: {}, dataDir: dir })).rejects.toThrow(/32/);
  });

  it('given BETTER_AUTH_SECRET, uses it and writes no file (23)', async () => {
    const dir = await dataDir();
    const secret = 'a-secret-set-by-the-administrator-0123456789';

    expect(await loadAuthSecret({ env: { BETTER_AUTH_SECRET: secret }, dataDir: dir })).toBe(secret);
    await expect(stat(join(dir, '.auth-secret'))).rejects.toThrow();
  });
});
