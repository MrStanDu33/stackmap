import type { LocaleDeclaration } from '@stackmap/extension-sdk';

/** The app's own languages, always complete. Locale packs add others. */
export const APP_LOCALES: readonly (LocaleDeclaration & { file: string })[] = [
  { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
  { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' },
];
