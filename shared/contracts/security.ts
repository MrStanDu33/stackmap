/**
 * The cookie Better Auth sets when someone signs in (`__Secure-` prefixed over HTTPS), described by the API document as
 * its security scheme; server/auth/auth.integration.test.ts checks that Better Auth uses it.
 */
export const SESSION_COOKIE = 'better-auth.session_token';
