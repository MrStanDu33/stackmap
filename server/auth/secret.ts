import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SECRET_FILE = 'auth-secret';

/**
 * The secret that signs sessions: `BETTER_AUTH_SECRET`, or one generated once into the data directory (owner-only),
 * so a first start needs no configuration and sessions survive restarts.
 */
export async function loadAuthSecret(
  { env, dataDir }: { env: { BETTER_AUTH_SECRET?: string }; dataDir: string },
): Promise<string> {
  const given = env.BETTER_AUTH_SECRET?.trim();
  if (given) {
    return given;
  }
  const file = join(dataDir, SECRET_FILE);
  try {
    return (await readFile(file, 'utf8')).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  const secret = randomBytes(32).toString('base64url');
  await mkdir(dataDir, { recursive: true });
  try {
    // `wx`: of two servers starting on the same directory, the second reads the first one's secret.
    await writeFile(file, `${secret}\n`, { mode: 0o600, flag: 'wx' });
    return secret;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
    return (await readFile(file, 'utf8')).trim();
  }
}
