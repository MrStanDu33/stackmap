import { mkdtemp, readFile, stat } from 'node:fs/promises';
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
    expect((await readFile(join(dir, 'auth-secret'), 'utf8')).trim()).toBe(first);
    expect((await stat(join(dir, 'auth-secret'))).mode & 0o777).toBe(0o600);
  });

  it('given BETTER_AUTH_SECRET, uses it and writes no file (23)', async () => {
    const dir = await dataDir();
    const secret = 'a-secret-set-by-the-administrator-0123456789';

    expect(await loadAuthSecret({ env: { BETTER_AUTH_SECRET: secret }, dataDir: dir })).toBe(secret);
    await expect(stat(join(dir, 'auth-secret'))).rejects.toThrow();
  });
});
