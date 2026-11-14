import { z } from 'zod';

/** What a person chose for themselves; `null` until chosen, which leaves the browser's own choice alone. */
export const THEMES = ['dark', 'light'] as const;
export const CONTRASTS = ['standard', 'strict'] as const;
// The app's locales (shared/i18n/locales.ts); a test keeps the two lists equal.
export const LOCALES = ['en', 'fr'] as const;
/** The pages `/` can open; inventory and plans join when they exist. */
export const LANDING_PAGES = ['graph', 'trace'] as const;

const chosen = <const T extends readonly [string, ...string[]]>(values: T, description: string) =>
  z.enum(values).nullable().meta({ description: `${description}, or null until chosen`, examples: [values[0]] });

export const Preferences = z.object({
  theme: chosen(THEMES, 'The color theme: `dark` (Midnight) or `light`'),
  contrast: chosen(CONTRASTS, 'The contrast: `standard`, or `strict` (AAA contrast, no motion, larger targets)'),
  locale: chosen(LOCALES, 'The interface language'),
  landingPage: chosen(LANDING_PAGES, 'The page `/` opens'),
}).meta({
  id: 'Preferences',
  description: 'A person\'s display preferences and landing page',
  examples: [{ theme: 'dark', contrast: null, locale: 'fr', landingPage: 'graph' }],
});

export type Preferences = z.infer<typeof Preferences>;

export const NO_PREFERENCES: Preferences = { theme: null, contrast: null, locale: null, landingPage: null };
