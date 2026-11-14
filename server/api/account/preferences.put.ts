import { updatePreferences } from '../../../shared/contracts/account';
import { savePreferences } from '../../repositories/preferences';
import { defineContractHandler } from '../../utils/contract-handler';
import { useDatabase } from '../../utils/database';

/** Saves the given preferences on the signed-in account; the client applies them and keeps its cookies in step. */
export default defineContractHandler(updatePreferences, async ({ body, session }) =>
  ({ status: 200, body: await savePreferences(await useDatabase(), session.user.id, body) }));
