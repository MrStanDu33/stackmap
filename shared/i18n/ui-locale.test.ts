import { describe, expect, it } from 'vitest';

import { uiLocaleFor } from './ui-locale';

describe('uiLocaleFor', () => {
  it('gives Nuxt UI\'s strings for the active language when Nuxt UI has it, English otherwise', () => {
    expect(uiLocaleFor('fr').code).toBe('fr');
    expect(uiLocaleFor('de').code).toBe('de');
    expect(uiLocaleFor('pt-BR').code).toBe('pt-BR');
    // A regional variant Nuxt UI lacks uses its base language; an unknown language uses English.
    expect(uiLocaleFor('fr-CA').code).toBe('fr');
    expect(uiLocaleFor('tlh').code).toBe('en');
  });
});
