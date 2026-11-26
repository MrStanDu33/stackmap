# Design

Where the design lives and the rules that keep it consistent. There is no design tool: the code and
[Storybook](https://mrstandu33.github.io/stackmap/) (`pnpm storybook`) are the reference, including its
**Foundations** pages (accessibility, color tokens, typography).

## Visual direction

A dense, technical tool for infrastructure engineers: dark first, calm, information before decoration. The default
theme is `midnight` (navy neutrals) with a violet `nebula` primary; `light` is the other theme. Color marks status,
selection and interaction, never information on its own. No illustrations. Tone of the copy: see
[PRODUCT.md](PRODUCT.md#tone).

## Where things are

| What | File |
|---|---|
| Palettes and semantic tokens per theme and contrast mode | `app/assets/css/tokens.css` |
| Nuxt UI color aliases (`primary` → nebula, `neutral` → midnight) | `shared/design/ui-colors.ts` |
| Component overrides (solid buttons, outlines) | `app/app.config.ts` |
| Contrast requirements, checked by tests | `shared/design/contrast.ts`, `tests/unit/design/theme-tokens.test.ts` |
| Fonts | system UI and system monospace stacks, in `tokens.css` |
| Icons | Lucide (`i-lucide-…`), bundled with `@iconify-json/lucide` |
| Foundations pages | `.storybook/foundations/` |

## Rules

- Use Nuxt UI components and semantic utilities (`text-muted`, `bg-elevated`, `text-primary`); never palette shades
  or raw colors. A token set for one theme is set for the other and for strict contrast too (`tokens.css` explains
  why).
- Two themes (`midnight`, `light`) × two contrast modes (`standard`, `strict`) × two locales: every story runs in each
  combination with axe.
- Strict contrast raises contrast to AAA, removes motion, keeps focus visible and enlarges targets; a system request
  for reduced motion removes motion too.
- Accessibility: RGAA 4.1 plus WCAG 2.2 AA's added criteria (see [ARCHITECTURE.md](ARCHITECTURE.md#interface)).
  Every graph has an accessible table or list equivalent.
- Components follow atomic design in `app/components/` (see `app/components/AGENTS.md`).
