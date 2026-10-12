import { version } from '../../package.json';
import { getHealth } from '../../shared/contracts/system';
import { pingDatabase } from '../database/connection';
import { defineContractHandler } from '../utils/contract-handler';
import { useDatabase } from '../utils/database';

/** Used by the Docker healthcheck and uptime monitors: the app answers and its database too. */
export default defineContractHandler(getHealth, async () => {
  try {
    await pingDatabase(await useDatabase());
    return { status: 200, body: { status: 'ok', version, database: 'ok' } };
  } catch (error) {
    // The error may name hosts or credentials: it goes to the logs, never to the response.
    console.error(`[health] The database does not answer: ${error instanceof Error ? error.message : String(error)}`);
    return { status: 503, body: { status: 'error', version, database: 'error' } };
  }
});
