import { describe, expect, it } from 'vitest';

import { CONTRAST_PAIRS, checkThemeContrast, contrastRatio, MIN_CONTRAST } from './contrast';

const WHITE = '#ffffff';
const BLACK = '#000000';

/** A theme where every checked pair is black on white or white on black (21:1). */
const passingTheme = (): Record<string, string> => ({
  bg: WHITE,
  'bg-muted': WHITE,
  'bg-elevated': WHITE,
  'text-inverted': WHITE,
  text: BLACK,
  'text-highlighted': BLACK,
  'text-toned': BLACK,
  'text-muted': BLACK,
  'text-dimmed': BLACK,
  primary: BLACK,
  secondary: BLACK,
  success: BLACK,
  info: BLACK,
  warning: BLACK,
  error: BLACK,
  'border-accented': BLACK,
});

describe('contrastRatio', () => {
  it('gives 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('gives 1:1 for identical colors', () => {
    expect(contrastRatio('#7a3fe8', '#7a3fe8')).toBeCloseTo(1, 5);
  });

  it('does not depend on the order of the colors', () => {
    expect(contrastRatio('#0d1020', '#a385ff')).toBeCloseTo(contrastRatio('#a385ff', '#0d1020'), 10);
  });

  it('accepts any CSS color syntax, including oklch', () => {
    expect(contrastRatio('oklch(0% 0 0)', 'white')).toBeCloseTo(21, 1);
  });

  it('throws on a value that is not a color', () => {
    expect(() => contrastRatio('var(--missing)', '#ffffff')).toThrow(/var\(--missing\)/);
  });
});

describe('contrast requirements', () => {
  it('follow WCAG AA in the standard themes', () => {
    expect(MIN_CONTRAST.standard).toEqual({ text: 4.5, ui: 3 });
  });

  it('follow WCAG AAA for text in strict mode', () => {
    expect(MIN_CONTRAST.strict).toEqual({ text: 7, ui: 4.5 });
  });

  it('cover body text, muted text, placeholders, links, solid buttons and input borders', () => {
    const pairs = CONTRAST_PAIRS.map(({ foreground, background }) => `${foreground}/${background}`);
    expect(pairs).toEqual(expect.arrayContaining([
      'text/bg',
      'text-muted/bg',
      'text-dimmed/bg',
      'primary/bg',
      'text-inverted/primary',
      'border-accented/bg',
    ]));
  });

  it.each(['secondary', 'success', 'info', 'warning', 'error'])(
    'cover the %s color as text and as a solid button background',
    (color) => {
      const pairs = CONTRAST_PAIRS.map(({ foreground, background }) => `${foreground}/${background}`);
      expect(pairs).toEqual(expect.arrayContaining([`${color}/bg`, `text-inverted/${color}`]));
    },
  );
});

describe('checkThemeContrast', () => {
  it('returns no failure for a theme that meets every requirement', () => {
    expect(checkThemeContrast(passingTheme(), 'strict')).toEqual([]);
  });

  it('reports a text pair below 4.5:1 in a standard theme', () => {
    const theme = { ...passingTheme(), 'text-muted': '#949494' };
    expect(checkThemeContrast(theme, 'standard')).toContainEqual(expect.objectContaining({
      foreground: 'text-muted',
      background: 'bg',
      required: 4.5,
    }));
  });

  it('accepts in a standard theme a text pair that strict mode rejects', () => {
    // #767676 on white is about 4.54:1.
    const theme = { ...passingTheme(), text: '#767676' };
    const textFailures = (level: 'standard' | 'strict') => checkThemeContrast(theme, level)
      .filter(({ foreground }) => foreground === 'text');
    expect(textFailures('standard')).toEqual([]);
    expect(textFailures('strict').length).toBeGreaterThan(0);
  });

  it('applies the 3:1 non-text requirement to UI pairs', () => {
    // #949494 on white is about 3.03:1: enough for a border, not for text.
    const theme = { ...passingTheme(), 'border-accented': '#949494' };
    expect(checkThemeContrast(theme, 'standard')).toEqual([]);
    expect(checkThemeContrast(theme, 'strict')).toContainEqual(expect.objectContaining({
      foreground: 'border-accented',
      required: 4.5,
    }));
  });

  it('includes the measured ratio in each failure', () => {
    const theme = { ...passingTheme(), text: '#ffffff' };
    const [failure] = checkThemeContrast(theme, 'standard').filter(({ foreground }) => foreground === 'text');
    expect(failure?.ratio).toBeCloseTo(1, 5);
  });

  it('reports a token missing from the theme', () => {
    const { primary: _removed, ...theme } = passingTheme();
    expect(checkThemeContrast(theme, 'standard')).toContainEqual(expect.objectContaining({
      foreground: 'primary',
      missing: true,
    }));
  });
});
