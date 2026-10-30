/** The median duration of a run, in ms, after a warm-up run (so the JIT has compiled it). */
function medianDuration(run: () => unknown, repeats = 5): number {
  run();
  const durations = Array.from({ length: repeats }, () => {
    const started = performance.now();
    run();
    return performance.now() - started;
  }).sort((a, b) => a - b);
  return durations[Math.floor(repeats / 2)] ?? 0;
}

/**
 * How much longer some work takes at 4× the size: about 4 when it grows linearly, 16 when quadratic, 64 when cubic.
 * A ratio, not a time budget, so it holds on slow runners and under coverage instrumentation. `work(size)` builds the
 * input and returns the run to time.
 */
export function growthRatio(work: (size: number) => () => unknown, size: number): number {
  const small = medianDuration(work(size));
  const large = medianDuration(work(size * 4));
  // Below half a millisecond, timer noise dominates: count it as half a millisecond.
  return large / Math.max(small, 0.5);
}
