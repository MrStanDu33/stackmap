import type { Preferences } from '#shared/contracts/preferences';

/** What the display shows now: theme, contrast and language. */
export interface Display {
  theme: NonNullable<Preferences['theme']>;
  contrast: NonNullable<Preferences['contrast']>;
  locale: NonNullable<Preferences['locale']>;
}

const DISPLAY = ['theme', 'contrast', 'locale'] as const;

/** The saved display preferences to apply: the chosen ones only, so the browser keeps its own for the others. */
export function preferencesToApply(saved: Preferences): Partial<Display> {
  return Object.fromEntries(DISPLAY.filter((key) => saved[key] !== null).map((key) => [key, saved[key]]));
}

/** The display preferences to save: those the display differs in from the account, or null when none. */
export function preferencesToSave(saved: Preferences, display: Display): Partial<Display> | null {
  const changed = DISPLAY.filter((key) => saved[key] !== display[key]);
  return changed.length > 0 ? Object.fromEntries(changed.map((key) => [key, display[key]])) : null;
}
