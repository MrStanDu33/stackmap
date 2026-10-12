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
4. Add `nuxt.config.ts` (the layer: `i18n.locales` with `en.json` and `fr.json`) and both locale files with every key.
5. Run `pnpm test:unit` (the built-in extension tests check the listing, translations, icons and versions),
   `pnpm lint`, `pnpm typecheck`, and `pnpm build` to see the layer load.
