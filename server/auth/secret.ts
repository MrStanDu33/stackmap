import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** The file the Docker image wrote before the app did: existing volumes keep their secret, and their sessions. */
const SECRET_FILE = '.auth-secret';
const MIN_LENGTH = 32;

const checked = (secret: string, source: string) => {
  if (secret.length < MIN_LENGTH) {
    throw new Error(`${source} must be at least ${String(MIN_LENGTH)} characters long.`);
  }
  return secret;
};

/**
 * The secret that signs sessions: `BETTER_AUTH_SECRET`, or one generated once into the data directory (owner-only),
 * so a first start needs no configuration and sessions survive restarts. An empty file, as after a crash while writing
 * it, is written again.
 */
export async function loadAuthSecret(
  { env, dataDir }: { env: { BETTER_AUTH_SECRET?: string }; dataDir: string },
): Promise<string> {
  const given = env.BETTER_AUTH_SECRET?.trim();
  if (given) {
    return checked(given, 'BETTER_AUTH_SECRET');
  }
  const file = join(dataDir, SECRET_FILE);
  let stored = '';
  try {
    stored = (await readFile(file, 'utf8')).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  if (stored) {
    return checked(stored, file);
  }
  const secret = randomBytes(32).toString('base64url');
  await mkdir(dataDir, { recursive: true });
  try {
    // `wx` when there is no file: of two servers starting on the same directory, the second reads the first's secret.
    await writeFile(file, `${secret}\n`, { mode: 0o600, flag: await exists(file) ? 'w' : 'wx' });
    return secret;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
    return checked((await readFile(file, 'utf8')).trim(), file);
  }
}

const exists = (file: string) => readFile(file).then(() => true, () => false);
