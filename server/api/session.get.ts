import { getSession } from '../../shared/contracts/auth';
import { defineContractHandler } from '../utils/contract-handler';
import { getRequestSession } from '../utils/session';

/** Who is signed in: the app asks on load to choose between the page, /login and /setup. */
export default defineContractHandler(getSession, async (_input, event) => ({
  status: 200,
  body: await getRequestSession(event),
}));
