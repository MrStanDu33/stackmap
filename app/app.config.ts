import { UI_COLORS } from '#shared/design/ui-colors';

/*
 * Solid buttons keep their background on hover and press, and underline their label instead: Nuxt UI fades the
 * background to 75%, which drops the label below 4.5:1 on the midnight theme (RGAA 3.2). Disabled ones are not
 * underlined; `not-disabled` rather than `enabled`, which links never match. Classes are written out so Tailwind
 * finds them.
 */
const solid = [
  { color: 'primary', variant: 'solid', class: 'hover:bg-primary active:bg-primary not-disabled:hover:underline' },
  { color: 'secondary', variant: 'solid', class: 'hover:bg-secondary active:bg-secondary not-disabled:hover:underline' },
  { color: 'success', variant: 'solid', class: 'hover:bg-success active:bg-success not-disabled:hover:underline' },
  { color: 'info', variant: 'solid', class: 'hover:bg-info active:bg-info not-disabled:hover:underline' },
  { color: 'warning', variant: 'solid', class: 'hover:bg-warning active:bg-warning not-disabled:hover:underline' },
  { color: 'error', variant: 'solid', class: 'hover:bg-error active:bg-error not-disabled:hover:underline' },
] as const;

/*
 * Checkboxes show a solid focus outline: Nuxt UI's is a quarter of the color, below 3:1 against the page (RGAA 10.7).
 */
const checkbox = [
  { color: 'primary', class: { base: 'outline-primary' } },
  { color: 'secondary', class: { base: 'outline-secondary' } },
  { color: 'success', class: { base: 'outline-success' } },
  { color: 'info', class: { base: 'outline-info' } },
  { color: 'warning', class: { base: 'outline-warning' } },
  { color: 'error', class: { base: 'outline-error' } },
] as const;

export default defineAppConfig({
  ui: {
    colors: UI_COLORS,
    button: { compoundVariants: [...solid] },
    checkbox: { compoundVariants: [...checkbox] },
  },
});
