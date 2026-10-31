import { describe, expect, it } from 'vitest';

import { growthRatio } from '../../support/timing';

/** Work whose cost grows with `steps`, kept from being optimised away. */
const loop = (steps: number) => () => {
  let total = 0;
  for (let step = 0; step < steps; step += 1) {
    total += step % 7;
  }
  return total;
};

const linear = (size: number) => loop(size * 100_000);
const quadratic = (size: number) => loop((size * 100) ** 2);

/** Busy-waits, as a runner busy with other work would make a run take longer. */
const stall = (ms: number) => {
  const until = performance.now() + ms;
  while (performance.now() < until) {
    // Spin.
  }
};

// Real work, timed many times: coverage instrumentation makes it several times slower.
describe('growthRatio', { timeout: 30_000 }, () => {
  it('measures about 4 for linear work and about 16 for quadratic work', () => {
    expect(growthRatio(linear, 10)).toBeLessThan(8);
    expect(growthRatio(quadratic, 10)).toBeGreaterThan(8);
  });

  it('is not inflated by a slowdown that hits a burst of consecutive runs of the larger size', () => {
    const burst = (size: number) => {
      const run = linear(size);
      let calls = 0;
      // The larger size's first runs land on a busy runner, as on a shared CI machine.
      return size > 10
        ? () => {
            calls += 1;
            if (calls <= 10) {
              stall(20);
            }
            return run();
          }
        : run;
    };

    expect(growthRatio(burst, 10)).toBeLessThan(8);
  });
});
