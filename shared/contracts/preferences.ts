import { z } from 'zod';

/** What a person chose for themselves; `null` until chosen, which leaves the browser's own choice alone. */
export const THEMES = ['dark', 'light'] as const;
export const CONTRASTS = ['standard', 'strict'] as const;
// The app's locales (shared/i18n/locales.ts); a test keeps the two lists equal.
export const LOCALES = ['en', 'fr'] as const;
/** The pages `/` can open; inventory and plans join when they exist. */
export const LANDING_PAGES = ['graph', 'trace'] as const;

/** The palette's groups, which Settings can hide. */
export const PALETTE_GROUPS = ['entities', 'pages', 'workspaces', 'actions'] as const;
const KEBAB = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*';
// A group, and for the filters to come an extension or an entity type:
// `group:pages`, `extension:nat`, `type:nat/port-forward`.
const PALETTE_KEY = new RegExp(`^(?:group:(?:${PALETTE_GROUPS.join('|')})|extension:${KEBAB}|type:${KEBAB}/${KEBAB})$`);
export const MAX_PALETTE_HIDDEN = 200;

export const PalettePreferences = z.strictObject({
  hidden: z.array(z.string().max(100).regex(PALETTE_KEY).meta({
    description: 'A group (`group:<id>`), an extension (`extension:<id>`) or an entity type (`type:<extension>/<entity>`)',
    examples: ['group:pages'],
  })).max(MAX_PALETTE_HIDDEN).meta({ description: 'What the palette neither lists nor searches', examples: [['group:pages']] }),
}).meta({ description: 'What the command palette shows', examples: [{ hidden: ['group:pages'] }] });

const chosen = <const T extends readonly [string, ...string[]]>(values: T, description: string) =>
  z.enum(values).nullable().meta({ description: `${description}, or null until chosen`, examples: [values[0]] });

export const Preferences = z.object({
  theme: chosen(THEMES, 'The color theme: `dark` (Midnight) or `light`'),
  contrast: chosen(CONTRASTS, 'The contrast: `standard`, or `strict` (AAA contrast, no motion, larger targets)'),
  locale: chosen(LOCALES, 'The interface language'),
  landingPage: chosen(LANDING_PAGES, 'The page `/` opens'),
  palette: PalettePreferences,
}).meta({
  id: 'Preferences',
  description: 'A person\'s display preferences, landing page and command palette',
  examples: [{ theme: 'dark', contrast: null, locale: 'fr', landingPage: 'graph', palette: { hidden: [] } }],
});

export type Preferences = z.infer<typeof Preferences>;

export const NO_PREFERENCES: Preferences = {
  theme: null, contrast: null, locale: null, landingPage: null, palette: { hidden: [] },
};
