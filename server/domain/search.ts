/** The most words of a query matched: each is a scan of the workspace's rows. */
export const MAX_SEARCH_WORDS = 8;

/** The most characters of an entity's text the index keeps. */
export const MAX_SEARCH_TEXT = 2000;

const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

const words = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(words);
  }
  return typeof value === 'string' || typeof value === 'number' ? [String(value)] : [];
};

/** Text to search in: lowercase, without accents, words separated by one space; lists and numbers as their text. */
export function normalizeSearchText(values: readonly unknown[]): string {
  return normalize(values.flatMap(words).join(' ')).slice(0, MAX_SEARCH_TEXT);
}

/** The LIKE patterns a query's words must all match, escaped with a backslash. */
export function searchPatterns(query: string): string[] {
  const words = [...new Set(normalize(query).split(' ').filter(Boolean))];
  // A word another one contains adds nothing: every row matching the longer one matches it.
  return words.filter((word) => !words.some((other) => other !== word && other.includes(word)))
    .slice(0, MAX_SEARCH_WORDS)
    .map((word) => `%${word.replace(/[\\%_]/g, '\\$&')}%`);
}

/** The most letters of a query matched in order: each is a wildcard the database tries along the text. */
export const MAX_SEARCH_LETTERS = 32;

/** The LIKE pattern finding a query's letters in that order (`%e%d%g%e%`), escaped with a backslash; null for none. */
export function letterPattern(query: string): string | null {
  const letters = Array.from(normalize(query).replace(/ /g, '')).slice(0, MAX_SEARCH_LETTERS);
  return letters.length > 0 ? `%${letters.map((letter) => letter.replace(/[\\%_]/g, '\\$&')).join('%')}%` : null;
}

/** Whether a normalized text holds a query's letters in that order, as `letterPattern` finds them. */
export function holdsLetters(text: string, query: string): boolean {
  const letters = Array.from(normalize(query).replace(/ /g, '')).slice(0, MAX_SEARCH_LETTERS);
  let found = 0;
  for (const character of text) {
    if (character === letters[found]) {
      found += 1;
    }
  }
  return letters.length > 0 && found === letters.length;
}
