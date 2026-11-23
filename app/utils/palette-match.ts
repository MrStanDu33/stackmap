/** Text as the palette compares it: no accents, lower case, trimmed. */
export const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

/** A text normalized character by character, with the index in the text each normalized character comes from. */
const mapped = (text: string) => {
  let normalized = '';
  const from: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    for (const character of (text[index] ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()) {
      normalized += character;
      from.push(index);
    }
  }
  return { normalized, from };
};

const range = (start: number, length: number) => Array.from({ length }, (_, offset) => start + offset);

/**
 * How what is typed matches a text, and where: rank 0 the whole text, 1 the starts of its words, 2 words found inside
 * it in any order, 3 its letters in that order; the marks are the matched characters' indices in the text.
 */
function match(text: string, typed: string): { rank: number; marks: number[] } | undefined {
  const wanted = normalize(typed).replace(/\s+/g, ' ');
  if (!wanted) {
    return undefined;
  }
  const { normalized, from } = mapped(text);
  const at = (positions: number[]) =>
    [...new Set(positions.map((position) => from[position] ?? 0))].sort((one, other) => one - other);
  // Each typed word's characters from where it was found.
  const spans = (indices: number[]) =>
    at(indices.flatMap((index, position) => range(index, typedWords[position]?.length ?? 0)));
  const typedWords = wanted.split(' ');
  const starts = [...normalized.matchAll(/\S+/g)].map(({ 0: word, index }) => ({ word, index }));

  if (normalized.trim().replace(/\s+/g, ' ') === wanted) {
    return { rank: 0, marks: at(starts.flatMap(({ word, index }) => range(index, word.length))) };
  }
  const byStart = typedWords.map((typedWord) => starts.find(({ word }) => word.startsWith(typedWord)));
  if (byStart.every(Boolean)) {
    return { rank: 1, marks: spans(byStart.map((found) => found?.index ?? 0)) };
  }
  const inside = typedWords.map((typedWord) => normalized.indexOf(typedWord));
  if (inside.every((index) => index >= 0)) {
    return { rank: 2, marks: spans(inside) };
  }
  const letters = wanted.replace(/ /g, '');
  const found: number[] = [];
  for (let index = 0; index < normalized.length && found.length < letters.length; index += 1) {
    if (normalized[index] === letters[found.length]) {
      found.push(index);
    }
  }
  return found.length === letters.length ? { rank: 3, marks: at(found) } : undefined;
}

/**
 * How closely a text matches what is typed: 0 the whole text, 1 the starts of its words, 2 words found inside it in
 * any order, 3 its letters in that order; undefined when it does not match.
 */
export const matchRank = (text: string, typed: string): number | undefined => match(text, typed)?.rank;

/** The indices in a text of the characters that matched what is typed, as `matchRank` matched them. */
export const matchMarks = (text: string, typed: string): number[] => match(text, typed)?.marks ?? [];
