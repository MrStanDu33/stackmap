---
name: new-component
description: Scaffold a Vue component at the right atomic-design level with its story, play function and translations.
argument-hint: <atom|molecule|organism|template> <ComponentName>
---

# New component

1. Check `app/components/` and Nuxt UI for an existing component first. Read `app/components/AGENTS.md`.
2. Write `app/components/<level>s/<Name>.stories.ts` **first**: one story per variant and state (default, loading,
   empty, error when relevant) with a `play` function asserting what the user sees and can do (roles and labels, not
   classes). Run `pnpm test:stories` and see it fail.
3. Write `app/components/<level>s/<Name>.vue`: `<script setup lang="ts">`, typed props and emits, Nuxt UI components,
   semantic color utilities, no raw colors.
4. Add every string to `i18n/locales/en.json` and `fr.json` under a key named after the component.
5. Run `pnpm test:stories` (every theme, contrast mode and locale, with axe), `pnpm lint` and `pnpm check:stories`.
