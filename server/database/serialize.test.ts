import { describe, expect, it } from 'vitest';

import { fromBoolean, fromJson, fromTimestamp, toBoolean, toJson, toTimestamp } from './serialize';

describe('database serialization', () => {
  describe('JSON columns', () => {
    it.each([
      { nested: { list: [1, 'two', null], ok: true } },
      ['a', 2, false],
      'plain text',
      42.5,
      true,
      null,
      { unicode: 'Hébergé ☁ 日本 🎉' },
    ])('round-trips objects, arrays, strings, numbers, booleans, null and Unicode through text (%j)', (value) => {
      const stored = toJson(value);
      expect(typeof stored).toBe('string');
      expect(fromJson(stored, 'appSetting.value')).toEqual(value);
    });

    it('given invalid JSON read from a column, fails with an error naming the column', () => {
      expect(() => fromJson('{not json', 'appSetting.value')).toThrow(/appSetting\.value/);
    });

    it.each([undefined, () => 1, Symbol('x')])('refuses to store a value that has no JSON form (%s)', (value) => {
      expect(() => toJson(value)).toThrow(/Cannot store/);
    });
  });

  describe('boolean columns', () => {
    it('stores false and true as 0 and 1 and reads them back', () => {
      expect(toBoolean(false)).toBe(0);
      expect(toBoolean(true)).toBe(1);
      expect(fromBoolean(0, 'flag')).toBe(false);
      expect(fromBoolean(1, 'flag')).toBe(true);
    });

    it.each([2, -1, 0.5])('given a stored value other than 0 or 1, fails (%s)', (value) => {
      expect(() => fromBoolean(value, 'workspace.archived')).toThrow(/workspace\.archived/);
    });
  });

  describe('timestamp columns', () => {
    it('stores a date as ISO-8601 UTC text with milliseconds', () => {
      expect(toTimestamp(new Date(Date.UTC(2026, 9, 11, 12, 34, 56, 789)))).toBe('2026-10-11T12:34:56.789Z');
      expect(toTimestamp(new Date(Date.UTC(2026, 0, 1)))).toBe('2026-01-01T00:00:00.000Z');
    });

    it('stores timestamps that sort chronologically as text', () => {
      const dates = [
        new Date(Date.UTC(2030, 0, 1)),
        new Date(Date.UTC(2026, 9, 11, 9)),
        new Date(Date.UTC(2026, 9, 11, 10)),
        new Date(Date.UTC(1999, 11, 31, 23, 59, 59, 999)),
        new Date(Date.UTC(2026, 9, 11, 9, 0, 0, 1)),
      ];
      const byText = dates.map(toTimestamp).sort();
      const byTime = [...dates].sort((a, b) => a.getTime() - b.getTime()).map(toTimestamp);
      expect(byText).toEqual(byTime);
    });

    it('reads the text back as the same Date', () => {
      const date = new Date(Date.UTC(2026, 9, 11, 12, 34, 56, 789));
      expect(fromTimestamp(toTimestamp(date), 'appSetting.updatedAt').getTime()).toBe(date.getTime());
    });

    it.each([
      '2026-10-11',
      '2026-10-11T12:34:56Z',
      '2026-10-11T12:34:56.789+02:00',
      '2026-13-40T99:00:00.000Z',
      'yesterday',
      // An impossible date that Date would silently move to March 2.
      '2026-02-30T00:00:00.000Z',
      // Extra text around an otherwise valid timestamp.
      ' 2026-10-11T12:34:56.789Z',
      '2026-10-11T12:34:56.789Z ',
    ])('given a stored value that is not an ISO-8601 UTC timestamp, fails (%s)', (text) => {
      expect(() => fromTimestamp(text, 'appSetting.updatedAt')).toThrow(/appSetting\.updatedAt/);
    });

    it('refuses to store an invalid date', () => {
      expect(() => toTimestamp(new Date(Number.NaN))).toThrow(/invalid date/i);
    });
  });
});
