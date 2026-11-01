import { describe, expect, it } from 'vitest';

import { slugify } from './slugify';

describe('slugify', () => {
  it('turns a name into lower-case kebab-case without accents, up to 48 characters (23)', () => {
    expect(slugify('My Homelab')).toBe('my-homelab');
    expect(slugify('  Réseau  d’été 2026 ')).toBe('reseau-d-ete-2026');
    expect(slugify('Lab_Paris / Edge--Nodes')).toBe('lab-paris-edge-nodes');
    // Cut at 48 without leaving a trailing hyphen.
    expect(slugify(`${'a'.repeat(47)} b`)).toBe('a'.repeat(47));
    expect(slugify('x'.repeat(60))).toHaveLength(48);
  });

  it('starts with a letter, as the API requires', () => {
    expect(slugify('2026 Homelab')).toBe('homelab');
    expect(slugify('42')).toBe('');
  });

  it('gives an empty slug for a name without letters or digits', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('   ')).toBe('');
  });
});
