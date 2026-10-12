# Built-in extensions

- One directory per extension: `extensions/<id>/`, with `package.json` (`@stackmap/extension-<id>`, the same version
  as the manifest), `manifest.ts`, `manifest.test.ts`, `nuxt.config.ts` (a Nuxt layer) and `i18n/locales/en.json` and
  `fr.json`. `/new-extension` scaffolds it.
- The manifest is `defineExtension({...})` from `@stackmap/extension-sdk`: it fails at load time when invalid. Every
  string is an i18n key under `extensions.<id>.`, defined in both locale files.
- Icons: a Lucide name (`i-lucide-…`), or an image in `public/extensions/<id>/` referenced as `/extensions/<id>/…`.
  Never a remote URL. Screens show `ExtensionIcon`, which falls back to a generic icon.
- Keep to your namespace: locale keys under `extensions.<id>.` and public files under `public/extensions/<id>/`, so
  no extension overrides another's strings or files (`checkExtension` reports it).
- Kinds are stored by id: kebab-case, never renamed once released, unique per entity across all extensions.
- Add the extension to `server/extensions/builtin.ts` and to the root `package.json` (`workspace:*`). The tests in
  `server/extensions/builtin.test.ts` check it is listed, translated and versioned; the registry refuses duplicate
  kinds, missing dependencies and cycles at startup.
- An always-on extension may only depend on other always-on extensions.
- Code: declare it in the manifest (`code: { server: true }`, `code: { client: true }`) and ship `server.ts`
  (`defineExtensionServer`) or `client.ts` (`defineExtensionClient`), exported as `./server` and `./client` and listed
  in `server/extensions/builtin.ts` or `app/extensions/builtin.ts`. Users are warned before installing code.
- Hooks: handle the app's hooks, your own (`<id>:<name>`, declared in `contributes.hooks`) and those of extensions you
  depend on or enhance (`enhances`). Payloads are plain JSON: ids and summaries, not whole entities. A handler that
  throws is logged and skipped; it never breaks the app.
- Locale packs: declare the languages you add in `contributes.locales` and ship `i18n/locales/<code>.json`; in those
  languages you may translate any key. Missing keys fall back to English.
- Debug with `STACKMAP_DEBUG=extensions` (server) or `localStorage['stackmap:debug'] = 'extensions'` (browser), and
  `GET /api/extensions/diagnostics`.
