import { describe, expect, it } from 'vitest';

import { LOCALES } from './preferences';
import { APP_LOCALES } from '../i18n/locales';

describe('preferences', () => {
  it('offers exactly the app\'s locales', () => {
    expect([...LOCALES]).toEqual(APP_LOCALES.map(({ code }) => code));
  });
});
