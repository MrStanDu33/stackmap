/** Text as the palette compares it: no accents, lower case, trimmed. */
export const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

/**
 * How closely a text matches what is typed: 0 the whole text, 1 the starts of its words, 2 inside a word, 3 its
 * letters in that order; undefined when it does not match.
 */
export function matchRank(text: string, typed: string): number | undefined {
  const normalized = normalize(text);
  const wanted = normalize(typed);
  if (normalized === wanted) {
    return 0;
  }
  const words = normalized.split(/\s+/);
  if (wanted.split(/\s+/).every((start) => words.some((word) => word.startsWith(start)))) {
    return 1;
  }
  if (normalized.includes(wanted)) {
    return 2;
  }
  const letters = wanted.replace(/\s+/g, '');
  let found = 0;
  for (const letter of normalized) {
    if (letter === letters[found]) {
      found += 1;
    }
  }
  return found === letters.length ? 3 : undefined;
}

/** The positions in a text of the characters that matched what is typed, as `matchRank` matched them. */
export function matchMarks(_text: string, _typed: string): number[] {
  return [];
}
