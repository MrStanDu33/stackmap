import { describe, expect, it } from 'vitest';

import i18nConfig from '../../../i18n/i18n.config';

describe('i18n fallback', () => {
  it('a key missing from a language falls back to English', () => {
    expect(i18nConfig()).toHaveProperty('fallbackLocale', 'en');
  });
});
