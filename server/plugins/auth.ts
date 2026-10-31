import { markServerStart } from '../auth/setup-window';

/** The setup window is counted from the server start. */
export default defineNitroPlugin(() => {
  markServerStart();
});
