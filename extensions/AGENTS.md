# Built-in extensions

- One directory per extension: `extensions/<id>/`, with `package.json` (`@stackmap/extension-<id>`, the same version
  as the manifest), `manifest.ts`, `manifest.test.ts`, `nuxt.config.ts` (a Nuxt layer) and `i18n/locales/en.json` and
  `fr.json`. `/new-extension` scaffolds it.
- The manifest is `defineExtension({...})` from `@stackmap/extension-sdk`: it fails at load time when invalid. Every
  string is an i18n key under `extensions.<id>.`, defined in both locale files.
- Icons: a Lucide name (`i-lucide-…`), or an image in `public/extensions/<id>/` referenced as `/extensions/<id>/…`.
  Never a remote URL. Screens show `ExtensionIcon`, which falls back to a generic icon.
- Kinds are stored by id: kebab-case, never renamed once released, unique per entity across all extensions.
- Add the extension to `server/extensions/builtin.ts` and to the root `package.json` (`workspace:*`). The tests in
  `server/extensions/builtin.test.ts` check it is listed, translated and versioned; the registry refuses duplicate
  kinds, missing dependencies and cycles at startup.
- An always-on extension may only depend on other always-on extensions.
