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

const runOnEmptyVolume = async (image: string, { platform, network }: { platform?: string; network?: string } = {}) => {
  const name = `stackmap-smoke-${randomUUID().slice(0, 8)}`;
  docker('volume', 'create', name);
  cleanups.push(() => docker('volume', 'rm', '-f', name));
  docker(
    'run', '-d', '--name', name,
    ...(platform ? ['--platform', platform] : []),
    ...(network ? ['--network', network] : []),
    '-v', `${name}:/data`, image,
  );
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
    const container = await runOnEmptyVolume(ARM64_IMAGE, { platform: 'linux/arm64' });

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

/** Fetches a page from inside the container (no published port needed). */
const fetchInside = (container: string, path: string) => {
  const script = `fetch('http://127.0.0.1:3000${path}').then(async (r) => console.log(JSON.stringify({ status: r.status, text: await r.text() })))`;
  return JSON.parse(docker('exec', container, 'node', '-e', script)) as { status: number; text: string };
};

/** Waits until a container's healthcheck reports the given status. */
const waitForHealth = async (container: string, expected: string, timeoutMs = 240_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (docker('inspect', '--format', '{{.State.Health.Status}}', container) === expected) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`${container} did not become ${expected}:\n${docker('logs', '--tail', '30', container)}`);
};

describe('API in the Docker image', () => {
  it('serves /api/docs with Scalar bundled in the app, without loading anything from a CDN', async () => {
    const container = await runOnEmptyVolume(IMAGE);

    const { status, text } = fetchInside(container, '/api/docs');

    expect(status).toBe(200);
    expect(text).toMatch(/scalar/i);
    // Scripts, styles, images and fonts come from the app; a plain link to another site loads nothing.
    expect(text.match(/<(?:script|link|img|iframe|source)\b[^>]*\b(?:src|href)=["']https?:\/\/[^"']+/g) ?? []).toEqual([]);
    // Inline styles: no remote fonts or images either.
    expect(text.match(/url\(\s*["']?https?:\/\/[^)]+/g) ?? []).toEqual([]);
  });

  it('serves the Lucide icons itself, without network access (no Iconify API)', async () => {
    const container = await runOnEmptyVolume(IMAGE, { network: 'none' });

    const { status, text } = fetchInside(container, '/api/_nuxt_icon/lucide.json?icons=puzzle');

    expect(status).toBe(200);
    expect(JSON.parse(text)).toHaveProperty(['icons', 'puzzle', 'body']);
  });

  it('with compose.postgres.yaml, becomes unhealthy when Postgres stops (the healthcheck calls /api/health)', async () => {
    const project = `stackmap-smoke-${randomUUID().slice(0, 8)}`;
    const compose = (...args: string[]) =>
      docker('compose', '-p', project, '-f', 'compose.yaml', '-f', 'compose.postgres.yaml', ...args);
    cleanups.push(() => compose('down', '--volumes'));
    compose('up', '-d', '--wait', '--wait-timeout', '300');
    const container = compose('ps', '-q', 'stackmap');

    compose('stop', 'postgres');

    await waitForHealth(container, 'unhealthy');
  });
});
