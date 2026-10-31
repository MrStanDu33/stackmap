import { afterEach, beforeEach } from 'vitest';

import { setSessionResolver } from '../../server/utils/session';

import type { Session } from '../../shared/contracts/auth';

/** The instance administrator, as route tests are signed in. */
export const ADMIN_SESSION: Session = {
  user: { id: '0199d6a0-0000-7000-8000-000000000101', name: 'Ada', email: 'ada@homelab.example', role: 'admin' },
};

/**
 * Makes every request of the file's tests signed in, for tests of what a route does once its role is checked (the
 * role checks themselves are in server/api/routes.test.ts and server/utils/contract-handler.test.ts).
 */
export function useSignedIn(session: Session = ADMIN_SESSION): void {
  beforeEach(() => {
    setSessionResolver(() => Promise.resolve(session));
  });
  afterEach(() => {
    setSessionResolver();
  });
}
