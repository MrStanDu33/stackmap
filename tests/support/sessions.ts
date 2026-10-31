import { afterEach, beforeEach } from 'vitest';

import { createAccount } from './accounts';
import { addMember } from '../../server/repositories/members';
import { setSessionResolver } from '../../server/utils/session';

import type { TestWorkspaces } from './workspaces';
import type { Database } from '../../server/database/types/schema';
import type { Session } from '../../shared/contracts/auth';
import type { WorkspaceRole } from '../../shared/contracts/contract';
import type { Kysely } from 'kysely';

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

/**
 * Signs every request of the enclosing `describe` in as a real account, a member of the test workspaces it names
 * (A and B by default) with the role it names, for routes that check workspace memberships. Call it after
 * `useTestWorkspaces`.
 */
export function useMemberOf(
  workspaces: TestWorkspaces,
  { role = 'viewer', of = ['a', 'b'] }: { role?: WorkspaceRole; of?: readonly ('a' | 'b')[] } = {},
): () => Session {
  let session: Session | undefined;
  beforeEach(async () => {
    const db = workspaces.db as unknown as Kysely<Database>;
    const member = await createAccount(db, { name: 'Ada', email: 'ada@homelab.example', admin: true });
    for (const key of of) {
      await addMember(db, { workspaceId: workspaces[key].workspace.id, userId: member.user.id, role });
    }
    session = member;
    setSessionResolver(() => Promise.resolve(member));
  });
  afterEach(() => {
    setSessionResolver();
  });
  return () => {
    if (!session) {
      throw new Error('The member exists only inside a test.');
    }
    return session;
  };
}
