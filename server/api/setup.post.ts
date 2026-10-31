import { getRequestURL } from 'h3';

import { setUp } from '../../shared/contracts/auth';
import { problemOf } from '../../shared/contracts/errors';
import { forwardCookies, throttle } from '../auth/requests';
import { setupWindowOpen } from '../auth/setup-window';
import { seedDemoWorkspace } from '../demo/seed-demo-workspace';
import { claimSetup, hasAccounts, releaseSetup, removeAccount } from '../repositories/accounts';
import { useAuth } from '../utils/auth';
import { defineContractHandler } from '../utils/contract-handler';
import { useDatabase } from '../utils/database';
import { useExtensionRegistry } from '../utils/extensions';

const logger = {
  info: (message: string) => {
    console.info(`[setup] ${message}`);
  },
  error: (message: string) => {
    console.error(`[setup] ${message}`);
  },
};

/** Creates the instance administrator once, signs them in, and adds the demo workspace when asked. */
export default defineContractHandler(setUp, async ({ body }, event) => {
  const db = await useDatabase();
  const instance = getRequestURL(event).pathname;
  const throttled = await throttle(db, event, 'setup');
  if (throttled) {
    return throttled;
  }
  const alreadySetUp = {
    status: 409 as const,
    body: problemOf('already_set_up', { detail: 'Stackmap is already set up: sign in instead.', instance }),
  };
  if (await hasAccounts(db)) {
    return alreadySetUp;
  }
  if (!setupWindowOpen()) {
    return {
      status: 403,
      body: problemOf('setup_closed', { detail: 'Setup is closed. Restart Stackmap to open it again.', instance }),
    };
  }
  // Of two concurrent requests, only one claims the setup; the other is told it is done.
  if (!await claimSetup(db, new Date())) {
    return alreadySetUp;
  }

  const auth = await useAuth();
  let user;
  try {
    const { headers, response } = await auth.api.signUpEmail({
      body: { name: body.name.trim(), email: body.email, password: body.password },
      headers: event.headers,
      returnHeaders: true,
    });
    forwardCookies(event, headers);
    user = response.user;
  } catch (error) {
    // All or nothing: an account created before the failure would leave setup done with nobody signed in.
    await removeAccount(db, body.email);
    await releaseSetup(db);
    throw error;
  }

  if (body.demo) {
    // The admin exists and is signed in whatever happens here: the seed is all or nothing, and logs its failure.
    await seedDemoWorkspace(db, { env: { STACKMAP_DEMO: 'true' }, registry: useExtensionRegistry(), logger })
      .catch((error: unknown) => {
        logger.error(`Could not add the demo workspace: ${error instanceof Error ? error.message : String(error)}`);
      });
  }
  return { status: 201, body: { user: { id: user.id, name: user.name, email: user.email, role: 'admin' } } };
});
