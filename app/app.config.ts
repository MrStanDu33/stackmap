import { UI_COLORS } from '#shared/design/ui-colors';

/*
 * Solid buttons keep their background on hover and press, and underline their label instead: Nuxt UI fades the
 * background to 75%, which drops the label below 4.5:1 on the midnight theme (RGAA 3.2). Classes are written out so
 * Tailwind finds them.
 */
const solid = [
  { color: 'primary', variant: 'solid', class: 'hover:bg-primary active:bg-primary hover:underline' },
  { color: 'secondary', variant: 'solid', class: 'hover:bg-secondary active:bg-secondary hover:underline' },
  { color: 'success', variant: 'solid', class: 'hover:bg-success active:bg-success hover:underline' },
  { color: 'info', variant: 'solid', class: 'hover:bg-info active:bg-info hover:underline' },
  { color: 'warning', variant: 'solid', class: 'hover:bg-warning active:bg-warning hover:underline' },
  { color: 'error', variant: 'solid', class: 'hover:bg-error active:bg-error hover:underline' },
] as const;

export default defineAppConfig({
  ui: {
    colors: UI_COLORS,
    button: { compoundVariants: [...solid] },
  },
});
