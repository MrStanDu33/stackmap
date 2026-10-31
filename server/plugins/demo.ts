import { seedDemoWorkspace } from '../demo/seed-demo-workspace';
import { useDatabase } from '../utils/database';
import { useExtensionRegistry, whenExtensionsStarted } from '../utils/extensions';

const logger = {
  info: (message: string) => {
    console.info(`[demo] ${message}`);
  },
  error: (message: string) => {
    console.error(`[demo] ${message}`);
  },
};

/**
 * Seeds the demo workspace when the server starts, once the extensions' tables exist (after 00.extensions and the
 * database plugin). Requests wait for it, so the first page sees the workspace; a failure is logged and the app
 * runs on.
 */
export default defineNitroPlugin((nitroApp) => {
  const ready = Promise.resolve()
    .then(async () => {
      await whenExtensionsStarted();
      await seedDemoWorkspace(await useDatabase(), {
        env: { STACKMAP_DEMO: process.env.STACKMAP_DEMO },
        registry: useExtensionRegistry(),
        logger,
      });
    })
    .catch((error: unknown) => {
      logger.error(`Could not seed the demo workspace: ${error instanceof Error ? error.message : String(error)}`);
    });

  nitroApp.hooks.hook('request', async () => {
    await ready;
  });
});
