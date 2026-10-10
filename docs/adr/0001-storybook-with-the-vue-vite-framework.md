# 1. Storybook with the Vue + Vite framework and Nuxt shims

- Status: accepted
- Date: 2026-10-10

## Context

Components are documented in Storybook, and their stories double as component tests: play functions plus axe, run in a
real browser, in every theme × contrast mode × locale. Three setups were compared in a timeboxed spike, on one atom and
one organism that use Nuxt UI, i18n, `useState`, `useRuntimeConfig` and `NuxtLink`:

- **A.** `@nuxtjs/storybook` / `@storybook-vue/nuxt` (real Nuxt runtime in Storybook) with the Vitest addon.
- **D.** Storybook for docs only; stories run as tests in Vitest's Nuxt environment (jsdom) through `composeStories`.
- **C.** `@storybook/vue3-vite` with the `@nuxt/ui/vite` plugin and small shims for the Nuxt APIs, with the Vitest addon.

Findings (Storybook 10.6, Nuxt 4.6, `@storybook-vue/nuxt` 10.0.0 and 10.0.1):

- **A fails.** Nuxt 4.6 replaced `unctx` with an internal context registry, while `@storybook-vue/nuxt` still registers
  the Nuxt app through `unctx`. `useNuxtApp()` then throws `NUXT_E1001`, in the Storybook UI as well as in tests. A
  four-line patch to the framework plus a color-mode shim made it work, but it means patching a dependency.
- **D works for tests but not for docs.** Its Storybook UI uses the same broken framework. jsdom cannot check color
  contrast, and the async locale loading of `@nuxtjs/i18n` needs extra care.
- **C works without patching anything.** The Storybook UI renders, stories run in Chromium through the Vitest addon, axe
  runs with color contrast, and locales switch synchronously.

## Decision

Use **C**: `@storybook/vue3-vite`, configured in `.storybook/main.ts` with:

- `@vitejs/plugin-vue` and the `@nuxt/ui/vite` plugin (Tailwind, Nuxt UI components and composables, `UI_COLORS`);
- `.storybook/nuxt-shims.ts`, which provides `useI18n` (vue-i18n with the app's locale files), `useState`,
  `clearNuxtState`, `useRuntimeConfig`, `useNuxtApp` and `NuxtLink`, wired as auto-imports;
- a decorator that applies the theme, contrast and locale toolbar globals and wraps stories in `UApp`.

`vitest.config.ts` runs the stories through `@storybook/addon-vitest` in headless Chromium, once per theme × contrast ×
locale (8 projects), with axe violations failing the test.

## Consequences

- Components must only use Nuxt APIs that the shims provide, through auto-imports (not explicit `#imports`). A component
  that needs more of Nuxt (data fetching, routing logic) belongs in a page or a container component, which is tested by
  e2e tests instead of stories. This matches the atomic design split.
- Adding a Nuxt API to a component means adding a shim, kept as small as possible.
- `@storybook/addon-themes` is not used: its entry point imports React, which breaks the Vitest setup. The theme toolbar
  is a few lines in the decorator.
- Revisit when `@storybook-vue/nuxt` supports Nuxt ≥ 4.6: a real Nuxt runtime would remove the shims.
