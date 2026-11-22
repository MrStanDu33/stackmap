import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import config from '../../../vitest.config';

import type { TestProjectInlineConfiguration } from 'vitest/config';

const ROOT = join(import.meta.dirname, '../../..');

const storyProjects = (projects: unknown) => (projects as TestProjectInlineConfiguration[])
  .filter(({ test }) => typeof test?.name === 'string' && test.name.startsWith('storybook:'));
const projects = storyProjects(config.test?.projects);

const stories = globSync('{app,extensions,.storybook}/**/*.stories.ts', { cwd: ROOT });
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');
const matching = (pattern: RegExp) => stories.filter((file) => pattern.test(read(file)));

/** A wait's own limit, such as `waitFor(…, { timeout: 2000 })`. */
const WAIT_TIMEOUT = /\btimeout\s*:/;
/** A fixed pause, such as `await new Promise((resolve) => setTimeout(resolve, 300))`. */
const PAUSE = /=>\s*setTimeout\(\s*resolve\b/;

/** Story tests pass or fail on the code alone: waits and clocks only stop hung stories (deterministic-stories spec). */
describe('story test projects', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('are the eight theme × contrast × locale projects', () => {
    expect(projects).toHaveLength(8);
  });

  it('stop a hung story after 120 s, and never sooner', () => {
    expect(projects.map((project) => project.test?.testTimeout)).toEqual(Array(8).fill(120_000));
  });

  it('run every story in a browser that prefers reduced motion', () => {
    const contexts = projects.map((project) => {
      const provider = project.test?.browser?.provider as { options?: { contextOptions?: object } } | undefined;
      return provider?.options?.contextOptions;
    });

    expect(contexts).toEqual(Array(8).fill(expect.objectContaining({ reducedMotion: 'reduce' })));
  });

  it('never retry a story', () => {
    expect(config.test?.retry ?? 0).toBe(0);
    expect(projects.map((project) => project.test?.retry ?? 0)).toEqual(Array(8).fill(0));
  });

  it('open one page per project, unless the flake hunt asks for more', async () => {
    expect(projects.map((project) => project.test?.maxWorkers)).toEqual(Array(8).fill(1));

    vi.stubEnv('STORY_PAGES_PER_PROJECT', '0');
    vi.resetModules();
    const hunted = storyProjects((await import('../../../vitest.config')).default.test?.projects);

    // Vitest's own default: (CPUs - 1) pages per project.
    expect(hunted.map((project) => project.test?.maxWorkers)).toEqual(Array(8).fill(undefined));
  });
});

describe('story files', () => {
  it('are all scanned', () => {
    expect(stories.length).toBeGreaterThan(40);
  });

  it('set no wait timeout of their own, so the 10 s guard applies to every wait', () => {
    expect(WAIT_TIMEOUT.test('await waitFor(() => expect(x).toBeVisible(), { timeout: 2000 });')).toBe(true);
    expect(WAIT_TIMEOUT.test('const delay = { timeout: 2000 };')).toBe(true);

    expect(matching(WAIT_TIMEOUT)).toEqual([]);
  });

  it('never pause for a fixed time', () => {
    expect(PAUSE.test('await new Promise((resolve) => setTimeout(resolve, 300));')).toBe(true);
    // A fixture's fake latency is no pause: the story waits for what it brings.
    expect(PAUSE.test('setTimeout(() => { error.value = \'invalid\'; }, 50);')).toBe(false);

    expect(matching(PAUSE)).toEqual([]);
  });
});
