import { markServerStart } from '../auth/setup-window';
import { releaseUnusedSetupClaim } from '../repositories/accounts';
import { useDatabase } from '../utils/database';

/**
 * The setup window is counted from the server start. A setup claim without an account, left by a crash during setup,
 * is released before the first request: restarting is what the setup page tells people to do.
 */
export default defineNitroPlugin((nitroApp) => {
  markServerStart();
  // After every plugin has run: the database plugin sets the database up.
  const ready = Promise.resolve()
    .then(async () => {
      await releaseUnusedSetupClaim(await useDatabase());
    })
    .catch((error: unknown) => {
      console.error(`[setup] Could not release an unused setup claim: ${error instanceof Error ? error.message : String(error)}`);
    });
  nitroApp.hooks.hook('request', async () => {
    await ready;
  });
});
