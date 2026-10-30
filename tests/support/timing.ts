/**
 * The fastest of several runs, in ms, after a warm-up run (so the JIT has compiled it). Other tests running in parallel
 * and garbage collection only ever add time, so the fastest run is the closest to the work's own cost.
 */
function fastestDuration(run: () => unknown, repeats = 7): number {
  run();
  return Math.min(...Array.from({ length: repeats }, () => {
    const started = performance.now();
    run();
    return performance.now() - started;
  }));
}

/**
 * How much longer some work takes at 4× the size: about 4 when it grows linearly, 16 when quadratic, 64 when cubic.
 * A ratio, not a time budget, so it holds on slow runners and under coverage instrumentation. `work(size)` builds the
 * input and returns the run to time.
 */
export function growthRatio(work: (size: number) => () => unknown, size: number): number {
  const small = fastestDuration(work(size));
  const large = fastestDuration(work(size * 4));
  // Below half a millisecond, timer noise dominates: count it as half a millisecond.
  return large / Math.max(small, 0.5);
}
