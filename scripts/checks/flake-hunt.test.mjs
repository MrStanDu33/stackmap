import { describe, expect, it, vi } from 'vitest';

import { hunt, huntRuns } from './flake-hunt.mjs';

const seeds = (...values) => {
  const next = vi.fn();
  for (const value of values) next.mockReturnValueOnce(value);
  return next;
};

/** `pnpm test:stories:hunt`: the story suite run again and again, shuffled and overloaded, to find flaky stories. */
describe('flake hunt', () => {
  it('runs the story suite 5 times by default, or the number of runs asked for', () => {
    expect(huntRuns()).toHaveLength(5);
    expect(huntRuns(2)).toHaveLength(2);
    expect(huntRuns()[0].args.slice(0, 4)).toEqual(['vitest', 'run', '--project', 'storybook:*']);
  });

  it('shuffles each run with a new seed', () => {
    const runs = huntRuns(2, seeds(11, 22));

    expect(runs.map(({ seed }) => seed)).toEqual([11, 22]);
    expect(runs[0].args).toEqual(expect.arrayContaining(['--sequence.shuffle', '--sequence.seed=11']));
    expect(runs[1].args).toEqual(expect.arrayContaining(['--sequence.shuffle', '--sequence.seed=22']));
  });

  it('never retries a story', () => {
    expect(huntRuns(1)[0].args).toContain('--retry=0');
  });

  it('overloads the runner with Vitest\'s default pages per project instead of one', () => {
    expect(huntRuns(1)[0].env).toEqual({ STORY_PAGES_PER_PROJECT: '0' });
  });

  it('prints each seed before its run starts', async () => {
    const events = [];
    await hunt({
      runs: 2,
      seed: seeds(11, 22),
      run: ({ seed }) => {
        events.push(`run ${seed}`);
        return Promise.resolve([]);
      },
      log: (line) => events.push(line),
    });

    expect(events.findIndex((event) => event.includes('11'))).toBeLessThan(events.indexOf('run 11'));
    expect(events.findIndex((event) => event.includes('22'))).toBeLessThan(events.indexOf('run 22'));
  });

  it('passes only when every run passes', async () => {
    const quiet = () => undefined;

    await expect(hunt({ runs: 3, seed: seeds(1, 2, 3), run: () => Promise.resolve([]), log: quiet })).resolves.toBe(0);
    const flaky = ({ seed }) => Promise.resolve(seed === 2 ? ['EntityTable.stories.ts > Default'] : []);
    await expect(hunt({ runs: 3, seed: seeds(1, 2, 3), run: flaky, log: quiet })).resolves.toBe(1);
  });

  it('names each failed story with the seed and the command that replays its run', async () => {
    const lines = [];
    await hunt({
      runs: 2,
      seed: seeds(11, 22),
      run: ({ seed }) => Promise.resolve(seed === 22 ? ['TrafficDetailPanel.stories.ts > Host'] : []),
      log: (line) => lines.push(line),
    });
    const report = lines.join('\n');

    expect(report).toContain('TrafficDetailPanel.stories.ts > Host');
    expect(report).toContain('STORY_PAGES_PER_PROJECT=0 pnpm exec vitest run --project \'storybook:*\' '
      + '--sequence.shuffle --sequence.seed=22 --retry=0');
  });
});
