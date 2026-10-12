/** Messages of a locale file: nested objects of strings. */
export interface Messages { [key: string]: string | Messages }

/** One extension's (or the app's, with `extension: null`) messages for a language. */
export interface LocaleSource {
  extension: string | null;
  messages: Messages;
}

export interface LocaleConflict {
  key: string;
  language: string;
  /** The extension whose translation is used (`null`: the app). */
  winner: string | null;
  ignored: (string | null)[];
}

/**
 * Merges every source's messages for a language. The key's owner (the app, or the extension of `extensions.<id>.…`)
 * wins with its own translation; otherwise the first source in order (registry order, the app first).
 */
export function mergeLocaleMessages(
  _language: string,
  _sources: readonly LocaleSource[],
): { messages: Messages; conflicts: LocaleConflict[] } {
  throw new Error('Not implemented');
}

/** The share of the reference (English) keys a language translates, and the keys it misses. */
export function localeCoverage(_reference: Messages, _messages: Messages): { coverage: number; missing: string[] } {
  throw new Error('Not implemented');
}
