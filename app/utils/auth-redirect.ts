/** What the client knows about accounts: whether setup is done, and whether someone is signed in. */
export interface AuthState {
  setUp: boolean;
  signedIn: boolean;
  /** The page `/` opens for this person; the graph when not chosen. */
  landingPage?: 'graph' | 'trace' | null;
  /** The account has a temporary password to replace before anything else. */
  mustChangePassword?: boolean;
}

const pathOf = (fullPath: string) => fullPath.split(/[?#]/)[0] ?? '';

/** Open to anyone: the API reference, which documents the public API description. */
const API_DOCS = /^\/api\/docs(?:\/|$)/;

/** Open to anyone once set up, signed in or not: an invitation link offers both to create an account and to sign in. */
const INVITATION = /^\/invite\/[\w-]+$/;

const PASSWORD_PAGE = '/settings/password';

/** Signed in: a temporary password first, then sign-in and setup lead home, and home is the landing page. */
function signedInRedirect(
  fullPath: string,
  path: string,
  { landingPage, mustChangePassword }: AuthState,
): string | null {
  if (mustChangePassword) {
    return path === PASSWORD_PAGE ? null : PASSWORD_PAGE;
  }
  if (path === PASSWORD_PAGE) {
    return '/settings';
  }
  if (path === '/login' || path === '/setup') {
    return '/';
  }
  return path === '/' ? `/${landingPage ?? 'graph'}${fullPath.slice(1)}` : null;
}

/** Where a page must send the visitor instead, or null to show it. */
export function authRedirect(fullPath: string, state: AuthState): string | null {
  const { setUp, signedIn } = state;
  const path = pathOf(fullPath);
  if (API_DOCS.test(path)) {
    return null;
  }
  if (!setUp) {
    return path === '/setup' ? null : '/setup';
  }
  if (INVITATION.test(path) && !state.mustChangePassword) {
    return null;
  }
  if (signedIn) {
    return signedInRedirect(fullPath, path, state);
  }
  if (path === '/login') {
    return null;
  }
  return path === '/setup' || path === '/' ? '/login' : `/login?redirect=${encodeURIComponent(fullPath)}`;
}

/**
 * A `redirect` query value, kept only when it is a path on this site: one slash, then not a slash or backslash
 * (`//host` and `/\host` leave the site), with nothing that decodes into one; `/` otherwise.
 */
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !/^\/(?![/\\])/.test(value)) {
    return '/';
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return '/';
  }
  return /^\/(?![/\\])/.test(decoded) && !/[\s\\]/.test(decoded) ? value : '/';
}
