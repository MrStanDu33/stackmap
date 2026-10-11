import { prepareDatabase } from '../database/startup';

const logger = {
  info: (message: string) => {
    console.info(`[database] ${message}`);
  },
};

/**
 * Connects to the database and applies pending migrations when the server starts. Requests wait until it is ready;
 * if it fails, the process exits so the container restarts with the error in its logs.
 */
export default defineNitroPlugin((nitroApp) => {
  const ready = prepareDatabase({ DATABASE_URL: process.env.DATABASE_URL, DATA_DIR: process.env.DATA_DIR }, logger);
  ready.catch((error: unknown) => {
    console.error(`[database] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });

  nitroApp.hooks.hook('request', async () => {
    await ready;
  });
  nitroApp.hooks.hook('close', async () => {
    await (await ready).destroy();
  });
});
