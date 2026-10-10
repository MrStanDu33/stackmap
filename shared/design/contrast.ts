import { parse, wcagContrast } from 'culori';

import type { Color } from 'culori';

export type ContrastLevel = 'standard' | 'strict';

/** `text` pairs follow WCAG 1.4.3/1.4.6, `ui` pairs (borders, focus rings) follow WCAG 1.4.11. */
export type ContrastKind = 'text' | 'ui';

export interface ContrastPair {
  /** Semantic token name, as in Nuxt UI's `--ui-<name>` variables. */
  foreground: string;
  background: string;
  kind: ContrastKind;
}

export interface ContrastFailure {
  foreground: string;
  background: string;
  required: number;
  /** Measured ratio, or null when a token is missing from the theme. */
  ratio: number | null;
  missing: boolean;
}

/** Strict mode raises text to AAA (7:1) and UI elements to the AA text level. */
export const MIN_CONTRAST: Readonly<Record<ContrastLevel, Readonly<Record<ContrastKind, number>>>> = {
  standard: { text: 4.5, ui: 3 },
  strict: { text: 7, ui: 4.5 },
};

/** Token pairs that every theme must keep readable. */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { foreground: 'text', background: 'bg', kind: 'text' },
  { foreground: 'text', background: 'bg-muted', kind: 'text' },
  { foreground: 'text', background: 'bg-elevated', kind: 'text' },
  { foreground: 'text-highlighted', background: 'bg', kind: 'text' },
  { foreground: 'text-toned', background: 'bg', kind: 'text' },
  { foreground: 'text-muted', background: 'bg', kind: 'text' },
  { foreground: 'text-muted', background: 'bg-elevated', kind: 'text' },
  // Placeholders use the dimmed color and are text under WCAG 1.4.3.
  { foreground: 'text-dimmed', background: 'bg', kind: 'text' },
  // Links and ghost buttons.
  { foreground: 'primary', background: 'bg', kind: 'text' },
  { foreground: 'primary', background: 'bg-elevated', kind: 'text' },
  // Solid buttons.
  { foreground: 'text-inverted', background: 'primary', kind: 'text' },
  // Status colors: as text (badges, alerts, links) and behind inverted text (solid buttons and badges).
  ...['secondary', 'success', 'info', 'warning', 'error'].flatMap((color): ContrastPair[] => [
    { foreground: color, background: 'bg', kind: 'text' },
    { foreground: 'text-inverted', background: color, kind: 'text' },
  ]),
  // Input and control boundaries.
  { foreground: 'border-accented', background: 'bg', kind: 'ui' },
  { foreground: 'border-accented', background: 'bg-elevated', kind: 'ui' },
];

/**
 * WCAG contrast ratio between two CSS colors, from 1 to 21.
 *
 * @throws When a value is not a color that can be parsed.
 */
export const contrastRatio = (foreground: string, background: string): number =>
  wcagContrast(toColor(foreground), toColor(background));

function toColor(value: string): Color {
  const color = parse(value);
  if (!color) {
    throw new TypeError(`"${value}" is not a CSS color.`);
  }
  return color;
}

const checkPair = (
  tokens: Readonly<Record<string, string>>,
  { foreground, background }: ContrastPair,
  required: number,
): ContrastFailure | null => {
  const fg = tokens[foreground];
  const bg = tokens[background];
  if (fg === undefined || bg === undefined) {
    return { foreground, background, required, ratio: null, missing: true };
  }
  const ratio = contrastRatio(fg, bg);
  return ratio < required ? { foreground, background, required, ratio, missing: false } : null;
};

/** Lists every pair of `CONTRAST_PAIRS` that the theme's resolved tokens fail at the given level. */
export const checkThemeContrast = (
  tokens: Readonly<Record<string, string>>,
  level: ContrastLevel,
): ContrastFailure[] => CONTRAST_PAIRS
  .map((pair) => checkPair(tokens, pair, MIN_CONTRAST[level][pair.kind]))
  .filter((failure) => failure !== null);
