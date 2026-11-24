# Components

- Pick the level: atoms (one element, no domain state), molecules (a few atoms), organisms (a section with behavior),
  templates (page layouts). Pages live in `app/pages/`.
- One component per file, PascalCase name, `<script setup lang="ts">`, typed props and emits.
- Next to each component: `<Name>.stories.ts` with a story per variant and state (default, loading, empty, error),
  and a `play` function asserting the behavior. Stories are the component tests.
- Use Nuxt UI components and semantic utilities; no palette shades or raw colors.
- Targets of at least 24 px, focus never hidden behind the sidebar or a panel, and a single-pointer alternative to
  every drag (WCAG 2.2). A component used in a page is also checked on that page in a browser (`/verify-ui`).
- Every string through `$t()` / `useI18n()`, added to both `i18n/locales/en.json` and `fr.json`.
- Nuxt APIs only through auto-imports (`useI18n`, `useState`, `useRuntimeConfig`, `useNuxtApp`, `useColorMode`, `useCookie`, `NuxtLink`). If a
  component needs more of Nuxt (data fetching, routing logic), it belongs in a page or container.
