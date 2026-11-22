/**
 * @typedef {{ seed: number, args: string[], env: Record<string, string> }} HuntRun
 * @typedef {{ runs?: number, seed?: () => number, run: (run: HuntRun) => Promise<string[]>,
 *   log: (line: string) => void }} HuntOptions
 */

/**
 * The story suite's runs in a hunt: each shuffled with its own seed, never retried, at Vitest's default pages.
 * @param {number} [runs]
 * @param {() => number} [seed]
 * @returns {HuntRun[]}
 */
// Stub until the implementation: no run at all.
export const huntRuns = (runs = 5, seed = () => 0) => (runs && seed ? [] : []);

/**
 * Runs the hunt and reports the failed stories with the command that replays their run.
 * @param {HuntOptions} options
 * @returns {Promise<0 | 1>}
 */
// Stub until the implementation: passes without running anything.
export const hunt = (options) => Promise.resolve(options ? 0 : 0);
