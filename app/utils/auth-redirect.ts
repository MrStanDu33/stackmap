/** What the client knows about accounts: whether setup is done, and whether someone is signed in. */
export interface AuthState {
  setUp: boolean;
  signedIn: boolean;
}

const pathOf = (fullPath: string) => fullPath.split(/[?#]/)[0] ?? '';

/** Pages open to anyone: the API reference, which documents the public API description. */
const PUBLIC = /^\/api\/docs(?:\/|$)/;

/** Where a page must send the visitor instead, or null to show it. */
export function authRedirect(fullPath: string, { setUp, signedIn }: AuthState): string | null {
  const path = pathOf(fullPath);
  if (PUBLIC.test(path)) {
    return null;
  }
  if (!setUp) {
    return path === '/setup' ? null : '/setup';
  }
  if (signedIn) {
    return path === '/login' || path === '/setup' ? '/' : null;
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
