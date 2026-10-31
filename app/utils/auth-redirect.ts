/** What the client knows about accounts: whether setup is done, and whether someone is signed in. */
export interface AuthState {
  setUp: boolean;
  signedIn: boolean;
}

/** Where a page must send the visitor instead, or null to show it. */
export const authRedirect = (_fullPath: string, _state: AuthState): string | null => null;

/** A `redirect` query value, kept only when it is a path on this site; `/` otherwise. */
export const safeRedirect = (_value: unknown): string => '';
