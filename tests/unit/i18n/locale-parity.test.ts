import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

interface Messages { [key: string]: string | Messages }

const LOCALES_DIR = join(import.meta.dirname, '../../../i18n/locales');
const SOURCE_LOCALE = 'en';
const PLACEHOLDER = /\{\s*(\w+)\s*\}/g;

const load = (code: string): Messages =>
  JSON.parse(readFileSync(join(LOCALES_DIR, `${code}.json`), 'utf8')) as Messages;

const flatten = (messages: Messages, prefix = ''): Map<string, string> => new Map(
  Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [[path, value]] : [...flatten(value, path)];
  }),
);

const placeholders = (message: string): string[] =>
  [...message.matchAll(PLACEHOLDER)].map(([, name]) => name ?? '').sort();

const codes = readdirSync(LOCALES_DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''));

const source = flatten(load(SOURCE_LOCALE));

describe('locale files', () => {
  it('include English and French', () => {
    expect(codes).toEqual(expect.arrayContaining(['en', 'fr']));
  });

  describe.each(codes)('given the %s locale', (code) => {
    const messages = flatten(load(code));

    it('has exactly the same keys as English', () => {
      expect([...messages.keys()].sort()).toEqual([...source.keys()].sort());
    });

    it('has no empty message', () => {
      const empty = [...messages].filter(([, message]) => message.trim() === '').map(([key]) => key);
      expect(empty).toEqual([]);
    });

    it('uses the same placeholders as English in every message', () => {
      const mismatched = [...messages]
        .filter(([key, message]) => source.has(key)
          && placeholders(message).join() !== placeholders(source.get(key) ?? '').join())
        .map(([key]) => key);
      expect(mismatched).toEqual([]);
    });
  });
});
