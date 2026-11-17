/** The most characters of an entity's text the index keeps. */
export const MAX_SEARCH_TEXT = 2000;

/** Text to search in: lowercase, without accents, words separated by one space. */
export function normalizeSearchText(_values: readonly unknown[]): string {
  throw new Error('Not implemented');
}

/** The LIKE patterns a query's words must all match, escaped with a backslash. */
export function searchPatterns(_query: string): string[] {
  throw new Error('Not implemented');
}
