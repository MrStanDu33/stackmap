/**
 * Nuxt UI color aliases → Tailwind palettes. Used by app.config.ts and Storybook.
 * nebula and midnight are defined in app/assets/css/tokens.css, the others are Tailwind defaults.
 * tokens.css sets the shade of each alias per theme; a test checks that both files agree.
 */
export const UI_COLORS = {
  primary: 'nebula',
  secondary: 'sky',
  success: 'emerald',
  info: 'blue',
  warning: 'amber',
  error: 'red',
  neutral: 'midnight',
} as const;
