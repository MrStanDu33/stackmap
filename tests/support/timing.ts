const duration = (run: () => unknown): number => {
  const started = performance.now();
  run();
  return performance.now() - started;
};

/**
 * How much longer some work takes at 4× the size: about 4 when it grows linearly, 16 when quadratic, 64 when cubic.
 * A ratio, not a time budget, so it holds on slow runners and under coverage instrumentation. `work(size)` builds the
 * input and returns the run to time.
 *
 * Each size is warmed up (so the JIT has compiled it), then the two sizes are timed in turn, and the fastest run of
 * each is kept. Other tests and garbage collection only ever add time; alternating spreads a busy spell of the runner
 * over both sizes, and enough runs make sure some of each fall outside it.
 */
export function growthRatio(work: (size: number) => () => unknown, size: number, repeats = 21): number {
  const small = work(size);
  const large = work(size * 4);
  small();
  large();
  let fastestSmall = Infinity;
  let fastestLarge = Infinity;
  for (let repeat = 0; repeat < repeats; repeat += 1) {
    fastestSmall = Math.min(fastestSmall, duration(small));
    fastestLarge = Math.min(fastestLarge, duration(large));
  }
  // Below half a millisecond, timer noise dominates: count it as half a millisecond.
  return fastestLarge / Math.max(fastestSmall, 0.5);
}
