import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { MIGRATIONS } from '../../server/database/migrations';

// Runs against built Docker images (pnpm test:smoke, in the Docker workflow), not in pnpm test.
// SMOKE_IMAGE is the image under test (default: stackmap:local, built by `docker compose up`); SMOKE_ARM64_IMAGE is an
// arm64 build of it (default: SMOKE_IMAGE, which already is arm64 on Apple silicon).
const IMAGE = process.env.SMOKE_IMAGE ?? 'stackmap:local';
const ARM64_IMAGE = process.env.SMOKE_ARM64_IMAGE ?? IMAGE;
// The line the app logs once it migrated the database (see server/database/startup.ts).
const APPLIED = `Applied database migrations: ${Object.keys(MIGRATIONS).join(', ')}`;

const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8' }).trim();

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    cleanup();
  }
});

/** Waits for a container's healthcheck, failing with its logs when it dies or times out. */
const waitUntilHealthy = async (container: string, timeoutMs = 180_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = docker('inspect', '--format', '{{.State.Status}} {{.State.Health.Status}}', container);
    if (status === 'running healthy') {
      return;
    }
    if (!status.startsWith('running')) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`${container} did not become healthy:\n${docker('logs', container)}`);
};

const runOnEmptyVolume = async (image: string, platform?: string) => {
  const name = `stackmap-smoke-${randomUUID().slice(0, 8)}`;
  docker('volume', 'create', name);
  cleanups.push(() => docker('volume', 'rm', '-f', name));
  docker('run', '-d', '--name', name, ...(platform ? ['--platform', platform] : []), '-v', `${name}:/data`, image);
  cleanups.push(() => docker('rm', '-f', name));

  await waitUntilHealthy(name);
  return name;
};

describe('Docker image', () => {
  it('given an empty /data, creates the SQLite file, applies the migrations and becomes healthy', async () => {
    const container = await runOnEmptyVolume(IMAGE);

    expect(docker('exec', container, 'sh', '-c', 'test -s /data/stackmap.sqlite && echo ok')).toBe('ok');
    expect(docker('logs', container)).toContain(APPLIED);
  });

  it('the arm64 image starts and migrates SQLite too', async () => {
    const container = await runOnEmptyVolume(ARM64_IMAGE, 'linux/arm64');

    expect(docker('exec', container, 'uname', '-m')).toBe('aarch64');
    expect(docker('logs', container)).toContain(APPLIED);
  });

  it('with compose.postgres.yaml, migrates Postgres and becomes healthy', () => {
    const project = `stackmap-smoke-${randomUUID().slice(0, 8)}`;
    const compose = (...args: string[]) =>
      docker('compose', '-p', project, '-f', 'compose.yaml', '-f', 'compose.postgres.yaml', ...args);
    cleanups.push(() => compose('down', '--volumes'));

    compose('up', '-d', '--wait', '--wait-timeout', '300');

    expect(compose('logs', 'stackmap')).toContain(APPLIED);
    expect(compose('exec', 'stackmap', 'sh', '-c', 'test -e /data/stackmap.sqlite || echo no-sqlite')).toBe('no-sqlite');
  });
});
