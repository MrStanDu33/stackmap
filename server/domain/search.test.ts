import { describe, expect, it } from 'vitest';

import { letterPattern, MAX_SEARCH_LETTERS, MAX_SEARCH_TEXT, normalizeSearchText, searchPatterns } from './search';

describe('normalizeSearchText', () => {
  it('lowercases, strips accents and collapses whitespace: "Édge  Router" becomes "edge router" (6)', () => {
    expect(normalizeSearchText(['Édge  Router'])).toBe('edge router');
    expect(normalizeSearchText(['  Ça\tmarche\n'])).toBe('ca marche');
  });

  it('joins lists and numbers as text separated by spaces, leaving out empty values (6)', () => {
    expect(normalizeSearchText(['Edge router', ['203.0.113.10', '2001:DB8::1'], 443, null, undefined, '']))
      .toBe('edge router 203.0.113.10 2001:db8::1 443');
  });

  it('cuts the text at 2000 characters (edge case)', () => {
    expect(normalizeSearchText(['a'.repeat(MAX_SEARCH_TEXT + 10)])).toHaveLength(MAX_SEARCH_TEXT);
  });
});

describe('searchPatterns', () => {
  it('splits a query into its normalized words, each a LIKE pattern to be matched anywhere (9, 10)', () => {
    expect(searchPatterns('  Édge   ROU ')).toEqual(['%edge%', '%rou%']);
  });

  it('escapes %, _ and \\ in each word with a backslash, so that LIKE matches them as themselves (11)', () => {
    expect(searchPatterns('50% a_b c\\d')).toEqual(['%50\\%%', '%a\\_b%', '%c\\\\d%']);
  });

  it('drops repeated words and words another word contains, and keeps at most 8 (review)', () => {
    expect(searchPatterns('e e edge ed router')).toEqual(['%edge%', '%router%']);
    expect(searchPatterns('w1 w2 w3 w4 w5 w6 w7 w8 w9 w10')).toHaveLength(8);
  });

  it('gives no pattern for a query of spaces only', () => {
    expect(searchPatterns('   ')).toEqual([]);
  });
});

describe('letterPattern', () => {
  it('finds the query\'s letters in that order, normalized, spaces left out: "Édge rt" gives %e%d%g%e%r%t% (palette 21)', () => {
    expect(letterPattern('Édge rt')).toBe('%e%d%g%e%r%t%');
  });

  it('escapes %, _ and \\ with a backslash, so that LIKE matches them as themselves (palette 21)', () => {
    expect(letterPattern('5%_\\')).toBe('%5%\\%%\\_%\\\\%');
  });

  it('keeps at most 32 letters, and gives none for a query of spaces only (palette 21, review)', () => {
    expect(letterPattern('a'.repeat(40))).toBe(`%${'a%'.repeat(MAX_SEARCH_LETTERS)}`);
    expect(letterPattern('   ')).toBeNull();
  });
});
