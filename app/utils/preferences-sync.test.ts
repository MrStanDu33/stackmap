import { describe, expect, it } from 'vitest';

import { preferencesToApply, preferencesToSave } from './preferences-sync';
import { NO_PREFERENCES } from '../../shared/contracts/preferences';

describe('preferences sync', () => {
  it('applies only the preferences that were chosen, leaving the browser\'s own for the others (3)', () => {
    expect(preferencesToApply(NO_PREFERENCES)).toEqual({});
    expect(preferencesToApply({ ...NO_PREFERENCES, theme: 'light', locale: 'fr', landingPage: 'trace' }))
      .toEqual({ theme: 'light', locale: 'fr' });
  });

  it('saves what the display differs in from the account, and nothing when they agree (4)', () => {
    const saved = { ...NO_PREFERENCES, theme: 'dark' as const };

    expect(preferencesToSave(saved, { theme: 'dark', contrast: 'standard', locale: 'en' }))
      .toEqual({ contrast: 'standard', locale: 'en' });
    expect(preferencesToSave({ theme: 'dark', contrast: 'standard', locale: 'en', landingPage: null },
      { theme: 'dark', contrast: 'standard', locale: 'en' })).toBeNull();
    expect(preferencesToSave(saved, { theme: 'light', contrast: 'standard', locale: 'en' }))
      .toEqual({ theme: 'light', contrast: 'standard', locale: 'en' });
  });
});
