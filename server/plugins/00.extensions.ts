import { version } from '../../package.json';
import { APP_LOCALES } from '../../shared/i18n/locales';
import { BUILTIN_EXTENSION_SERVERS, BUILTIN_EXTENSIONS } from '../extensions/builtin';
import { createExtensionRegistry } from '../extensions/registry';
import { startExtensions } from '../extensions/runtime';
import { useDatabase } from '../utils/database';
import { setExtensionRegistry, setExtensionRuntime } from '../utils/extensions';

import type { ExtensionRegistry } from '../extensions/registry';

const exitWith = (error: unknown) => {
  console.error(`[extensions] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
};

/**
 * Starts the extensions when the server starts. A failed extension is logged and turned off, with its dependents;
 * only a failed always-on extension (the core) stops the server. Named 00. so that it runs, and closes, before the
 * database plugin: `app:close` handlers can still use the database.
 */
export default defineNitroPlugin((nitroApp) => {
  let registry: ExtensionRegistry;
  try {
    registry = createExtensionRegistry(BUILTIN_EXTENSIONS, {
      servers: BUILTIN_EXTENSION_SERVERS,
      appLocales: APP_LOCALES,
    });
  } catch (error) {
    exitWith(error);
    return;
  }
  for (const { manifest, errors } of registry.extensions.filter(({ state }) => state === 'failed')) {
    console.error(`[extension:${manifest.id}] failed: ${errors.join('; ')}`);
  }
  setExtensionRegistry(registry);

  // After every plugin ran (the database plugin included) and the database is migrated.
  const ready = Promise.resolve().then(async () => {
    await useDatabase();
    const runtime = await startExtensions(registry);
    await runtime.callHook('app:ready', { version });
    return runtime;
  });
  ready.catch(exitWith);
  setExtensionRuntime(ready);

  nitroApp.hooks.hook('request', async () => {
    await ready;
  });
  nitroApp.hooks.hook('close', async () => {
    await (await ready).callHook('app:close', {});
  });
});
