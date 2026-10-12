import { describe, expect, it } from 'vitest';

import { line, text } from './formats';

describe('text formats', () => {
  it('free text keeps tabs, line breaks and Unicode, emoji sequences included', () => {
    // U+200D joins emoji sequences, so it stays allowed.
    expect(text(200).safeParse('# Notes\n\n- item\twith a tab\r\nÜnïcödé 日本語 مرحبا 👨‍👩‍👧').success).toBe(true);
  });

  it('one-line text refuses tabs and line breaks', () => {
    expect(line(100).safeParse('Café — serveur ✓').success).toBe(true);
    for (const value of ['two\nlines', 'a\ttab', 'carriage\rreturn']) {
      expect(line(100).safeParse(value).success, JSON.stringify(value)).toBe(false);
    }
  });

  it.each([
    ['a null byte', 'null \u0000 byte'],
    ['a C1 control character', 'next\u0085line'],
    ['a zero-width space', 'a​b'],
    ['a right-to-left override', 'admin‮gnp.exe'],
    ['a directional isolate', 'before ⁦isolated⁩ after'],
    ['a byte order mark', '﻿vm-104'],
  ])('both refuse %s', (_name, value) => {
    expect(text(200).safeParse(value).success).toBe(false);
    expect(line(200).safeParse(value).success).toBe(false);
  });
});
