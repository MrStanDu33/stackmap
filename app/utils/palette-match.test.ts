import { describe, expect, it } from 'vitest';

import { matchMarks, matchRank } from './palette-match';

describe('matchRank', () => {
  it('ranks a match: 0 the whole text, 1 the starts of its words, 2 words found inside it in any order, 3 its letters in order (21)', () => {
    expect(matchRank('Host', 'host')).toBe(0);
    expect(matchRank('Port forward', 'port f')).toBe(1);
    expect(matchRank('Switch to the light theme', 'theme light')).toBe(1);
    expect(matchRank('Port forward', 'ort')).toBe(2);
    expect(matchRank('Switch to the light theme', 'eme ight')).toBe(2);
    expect(matchRank('Port forward', 'ofw')).toBe(3);
  });

  it('ignores case and accents, and gives undefined when nothing matches (21)', () => {
    expect(matchRank('Hôte', ' HOTE ')).toBe(0);
    expect(matchRank('Host', 'x')).toBeUndefined();
    expect(matchRank('Host', '')).toBeUndefined();
  });

  it('matches letters in the order typed only: "fdw" does not match Port forward (21)', () => {
    expect(matchRank('Port forward', 'fdw')).toBeUndefined();
    expect(matchRank('Edge router', 'tgde')).toBeUndefined();
  });
});

describe('matchMarks', () => {
  it('gives each letter found in order: "ofw" in Port forward gives 1, 5 and 8 (22)', () => {
    expect(matchMarks('Port forward', 'ofw')).toEqual([1, 5, 8]);
  });

  it('gives the whole text, the starts of words or the words found inside it, as matched, ignoring case and accents (22)', () => {
    expect(matchMarks('Host', 'host')).toEqual([0, 1, 2, 3]);
    expect(matchMarks('Hôte', 'HOTE')).toEqual([0, 1, 2, 3]);
    expect(matchMarks('Port forward', 'f port')).toEqual([0, 1, 2, 3, 5]);
    expect(matchMarks('Port forward', 'ort')).toEqual([1, 2, 3]);
    expect(matchMarks('Switch to the light theme', 'eme ight')).toEqual([15, 16, 17, 18, 22, 23, 24]);
  });

  it('gives nothing for a text that does not match (22)', () => {
    expect(matchMarks('Port forward', 'fdw')).toEqual([]);
    expect(matchMarks('Port forward', '')).toEqual([]);
  });
});
