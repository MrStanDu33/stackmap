import { describe, expect, it } from 'vitest';

import { MAX_SEARCH_TEXT, normalizeSearchText, searchPatterns } from './search';

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

  it('gives no pattern for a query of spaces only', () => {
    expect(searchPatterns('   ')).toEqual([]);
  });
});
