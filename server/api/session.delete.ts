import { signOut } from '../../shared/contracts/auth';
import { forwardCookies } from '../auth/requests';
import { useAuth } from '../utils/auth';
import { defineContractHandler } from '../utils/contract-handler';

/** Ends the session on the server and clears its cookie. */
export default defineContractHandler(signOut, async (_input, event) => {
  const auth = await useAuth();
  const { headers } = await auth.api.signOut({ headers: event.headers, returnHeaders: true });
  forwardCookies(event, headers);
  return { status: 200, body: null };
});
