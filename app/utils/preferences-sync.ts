import type { Preferences } from '#shared/contracts/preferences';

/** What the display shows now: theme, contrast and language. */
export type Display = { theme: NonNullable<Preferences['theme']>; contrast: NonNullable<Preferences['contrast']>; locale: NonNullable<Preferences['locale']> };

/** The saved display preferences to apply: the chosen ones only. */
export function preferencesToApply(_saved: Preferences): Partial<Display> {
  throw new Error('Not implemented');
}

/** The display preferences to save: those the display differs in from the account, or null when none. */
export function preferencesToSave(_saved: Preferences, _display: Display): Partial<Display> | null {
  throw new Error('Not implemented');
}
