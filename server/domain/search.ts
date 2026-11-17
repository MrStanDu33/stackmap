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
  return normalize(query).split(' ').filter(Boolean).map((word) => `%${word.replace(/[\\%_]/g, '\\$&')}%`);
}
