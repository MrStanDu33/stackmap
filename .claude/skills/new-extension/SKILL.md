---
name: new-extension
description: Scaffold a built-in extension (package, manifest, Nuxt layer, locales, tests) with the extension SDK.
argument-hint: <extension-id>
---

# New built-in extension

1. Read `extensions/AGENTS.md` and the Extensions section of `docs/ARCHITECTURE.md`. Pick a kebab-case id that no
   other extension uses; check the kinds it will add do not exist yet (`server/extensions/builtin.ts`).
2. Write `extensions/<id>/manifest.test.ts` **first**, asserting what the extension contributes (its kinds by entity,
   its dependencies). Create `package.json` (`@stackmap/extension-<id>`, `"version": "0.0.0"`, `"type": "module"`,
   `"exports": { ".": "./manifest.ts" }`, `@stackmap/extension-sdk` as a `workspace:*` dependency) and a
   `manifest.ts` stub, add the package to `server/extensions/builtin.ts` and to the root `package.json`, run
   `pnpm install`, then `pnpm test:unit` and see the tests fail.
3. Write `manifest.ts` with `defineExtension()`: `apiVersion: 1`, name, description and kind labels as keys under
   `extensions.<id>.`, Lucide icons (or images in `public/extensions/<id>/`).
4. Add `nuxt.config.ts` (the layer: `defineNuxtConfig({})`) and `i18n/locales/en.json` and `fr.json` with every key;
   the build merges them with the app's. For code, declare `code` in the manifest and add `server.ts` or `client.ts`
   (with `"./server"` or `"./client"` in `exports`), listed in `server/extensions/builtin.ts` or
   `app/extensions/builtin.ts`; test its hooks first.
5. For entities, follow `extensions/AGENTS.md`: test first (its schema test, then an integration test running
   `describeScopedRepository`), then the manifest entry, schema, migration (`server/migrations/0001_…`), repository
   definition and `EntityRepositories` augmentation, a factory in `testing/`, and both locales' entity labels.
6. Run `pnpm test:unit` (the built-in extension tests check the listing, translations, icons and versions),
   `pnpm lint`, `pnpm typecheck`, and `pnpm build` to see the layer load.
