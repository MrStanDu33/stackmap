import { describe, expect, it } from 'vitest';

import { newId } from './ids';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('identifiers', () => {
  it('returns an RFC 9562 UUID version 7 (version nibble 7, variant 10)', () => {
    for (let index = 0; index < 100; index += 1) {
      expect(newId()).toMatch(UUID_V7);
    }
  });

  it('returns IDs that sort as text in creation order, including within the same millisecond', () => {
    // Thousands of IDs are created within a few milliseconds, so many share one.
    const ids = Array.from({ length: 5000 }, () => newId());
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
