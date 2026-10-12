/** Messages of a locale file: nested objects of strings. */
export interface Messages { [key: string]: string | Messages }

/** One extension's (or the app's, with `extension: null`) messages for a language. */
export interface LocaleSource {
  extension: string | null;
  /** Whether the extension declares this language (a locale pack): only then may it translate others' keys. */
  declares?: boolean;
  messages: Messages;
}

export interface LocaleConflict {
  key: string;
  language: string;
  /** The extension whose translation is used (`null`: the app). */
  winner: string | null;
  ignored: (string | null)[];
}

/** `{ a: { b: 'B' } }` → `a.b` → `B`. */
export const flattenMessages = (messages: Messages, prefix = ''): Map<string, string> => new Map(
  Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [[path, value]] : [...flattenMessages(value, path)];
  }),
);

const nest = (entries: Iterable<[string, string]>): Messages => {
  const messages: Messages = {};
  for (const [key, value] of entries) {
    const parts = key.split('.');
    const leaf = parts.pop() ?? key;
    let node = messages;
    for (const part of parts) {
      const next = node[part];
      node = typeof next === 'object' ? next : (node[part] = {});
    }
    node[leaf] = value;
  }
  return messages;
};

/** The owner of a key: the extension of `extensions.<id>.…`, or the app (`null`). */
const ownerOf = (key: string) => (key.startsWith('extensions.') ? key.split('.')[1] ?? null : null);

/**
 * Merges every source's messages for a language. The key's owner (the app, or the extension of `extensions.<id>.…`)
 * wins with its own translation; otherwise the first pack declaring the language, in order (registry order).
 */
export function mergeLocaleMessages(
  language: string,
  sources: readonly LocaleSource[],
): { messages: Messages; conflicts: LocaleConflict[] } {
  const candidates = new Map<string, { source: string | null; value: string }[]>();
  for (const { extension, declares = false, messages } of sources) {
    for (const [key, value] of flattenMessages(messages)) {
      // Only a key's owner, or a pack that declares the language, may translate it: no other extension can reword
      // the app's strings (warnings included) or another extension's.
      if (declares || ownerOf(key) === extension) {
        candidates.set(key, [...(candidates.get(key) ?? []), { source: extension, value }]);
      }
    }
  }

  const merged = new Map<string, string>();
  const conflicts: LocaleConflict[] = [];
  for (const [key, translations] of candidates) {
    const winner = translations.find(({ source }) => source === ownerOf(key)) ?? translations[0];
    if (!winner) {
      continue;
    }
    merged.set(key, winner.value);
    const ignored = translations.filter((translation) => translation !== winner && translation.value !== winner.value);
    if (ignored.length > 0) {
      conflicts.push({ key, language, winner: winner.source, ignored: ignored.map(({ source }) => source) });
    }
  }
  return { messages: nest(merged), conflicts: conflicts.sort((a, b) => a.key.localeCompare(b.key)) };
}

/** The share of the reference (English) keys a language translates, and the keys it misses. */
export function localeCoverage(reference: Messages, messages: Messages): { coverage: number; missing: string[] } {
  const translated = flattenMessages(messages);
  const keys = [...flattenMessages(reference).keys()];
  const missing = keys.filter((key) => !translated.get(key)?.trim()).sort();
  return { coverage: keys.length === 0 ? 1 : (keys.length - missing.length) / keys.length, missing };
}
