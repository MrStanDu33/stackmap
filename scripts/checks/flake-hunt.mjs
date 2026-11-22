/**
 * @typedef {{ seed: number, args: string[], env: Record<string, string> }} HuntRun
 * @typedef {{ runs?: number, seed?: () => number, run: (run: HuntRun) => Promise<string[]>,
 *   log: (line: string) => void }} HuntOptions
 */

const SUITE = ['vitest', 'run', '--project', 'storybook:*'];
// Vitest's default pages per project (vitest.config.ts): the load that made first stories time out on CI.
const OVERLOAD = { STORY_PAGES_PER_PROJECT: '0' };

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

/**
 * The story suite's runs in a hunt: each shuffled with its own seed, never retried, at Vitest's default pages.
 * @param {number} [runs]
 * @param {() => number} [seed]
 * @returns {HuntRun[]}
 */
export const huntRuns = (runs = 5, seed = randomSeed) => Array.from({ length: runs }, () => {
  const value = seed();
  return { seed: value, args: [...SUITE, '--sequence.shuffle', `--sequence.seed=${value}`, '--retry=0'], env: OVERLOAD };
});

/** @param {HuntRun} run */
const replay = ({ args, env }) => [
  ...Object.entries(env).map(([name, value]) => `${name}=${value}`),
  'pnpm exec',
  ...args.map((arg) => (arg.includes('*') ? `'${arg}'` : arg)),
].join(' ');

/**
 * Runs the hunt and reports the failed stories with the command that replays their run.
 * @param {HuntOptions} options
 * @returns {Promise<0 | 1>}
 */
export const hunt = async ({ runs = 5, seed = randomSeed, run, log }) => {
  const failures = [];
  for (const [index, hunted] of huntRuns(runs, seed).entries()) {
    log(`Run ${String(index + 1)}/${String(runs)}, seed ${String(hunted.seed)}`);
    const failed = await run(hunted);
    if (failed.length > 0) {
      failures.push({ hunted, failed });
    }
  }
  if (failures.length === 0) {
    log(`✔ ${String(runs)} runs, no flaky story.`);
    return 0;
  }
  for (const { hunted, failed } of failures) {
    log(`✖ Seed ${String(hunted.seed)}:\n${failed.map((story) => `    ${story}`).join('\n')}\n  Replay: ${replay(hunted)}`);
  }
  return 1;
};
