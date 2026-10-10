// Initial toolbar globals, set per story-test project in vitest.config.ts.
interface ImportMetaEnv {
  readonly STORYBOOK_THEME?: 'midnight' | 'light';
  readonly STORYBOOK_CONTRAST?: 'standard' | 'strict';
  readonly STORYBOOK_LOCALE?: 'en' | 'fr';
}
