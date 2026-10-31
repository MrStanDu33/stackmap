import { getSetup } from '../../shared/contracts/auth';
import { setupTimeoutMinutes, setupWindowOpen } from '../auth/setup-window';
import { hasAccounts } from '../repositories/accounts';
import { defineContractHandler } from '../utils/contract-handler';
import { useDatabase } from '../utils/database';

/** For the /setup page: whether to show the form, say the window closed, or move on to sign-in. */
export default defineContractHandler(getSetup, async () => {
  const minutes = setupTimeoutMinutes();
  if (await hasAccounts(await useDatabase())) {
    return { status: 200, body: { state: 'done', minutes } };
  }
  return { status: 200, body: { state: setupWindowOpen(new Date(), minutes) ? 'open' : 'closed', minutes } };
});
