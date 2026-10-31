import { describe, expect, it } from 'vitest';

import { authRedirect, safeRedirect } from './auth-redirect';

const fresh = { setUp: false, signedIn: false };
const signedOut = { setUp: true, signedIn: false };
const signedIn = { setUp: true, signedIn: true };

describe('authRedirect', () => {
  it('given no account, sends every page to /setup (1)', () => {
    expect(authRedirect('/graph', fresh)).toBe('/setup');
    expect(authRedirect('/login', fresh)).toBe('/setup');
    expect(authRedirect('/setup', fresh)).toBeNull();
  });

  it('given an account and no session, sends a page to /login?redirect=<path> (9)', () => {
    expect(authRedirect('/trace?hostname=app.homelab.example&client=public', signedOut))
      .toBe(`/login?redirect=${encodeURIComponent('/trace?hostname=app.homelab.example&client=public')}`);
    expect(authRedirect('/setup', signedOut)).toBe('/login');
    expect(authRedirect('/login', signedOut)).toBeNull();
  });

  it('given a session, sends /login and /setup to / and lets other pages through (15)', () => {
    expect(authRedirect('/login', signedIn)).toBe('/');
    expect(authRedirect('/login?redirect=/graph', signedIn)).toBe('/');
    expect(authRedirect('/setup', signedIn)).toBe('/');
    expect(authRedirect('/graph?view=list', signedIn)).toBeNull();
  });
});

describe('safeRedirect', () => {
  it('keeps a same-origin path with its query (9)', () => {
    expect(safeRedirect('/graph')).toBe('/graph');
    expect(safeRedirect('/trace?hostname=app.homelab.example&client=public')).toBe('/trace?hostname=app.homelab.example&client=public');
  });

  it('given //evil.example, https://…, /\\evil, javascript: or nothing, gives / (14)', () => {
    for (const value of ['//evil.example', 'https://evil.example/', '/\\evil.example', 'javascript:alert(1)', 'graph', '',
      undefined, ['/graph'], '/%2F%2Fevil.example', ' /graph']) {
      expect(safeRedirect(value), String(value)).toBe('/');
    }
  });
});
