import { createApp, createRouter, toWebHandler } from 'h3';
import { sql } from 'kysely';
import { afterEach, beforeEach, vi } from 'vitest';

import { BUILTIN_REGISTRY, useTestWorkspaces } from './workspaces';
import sessionDelete from '../../server/api/session.delete';
import sessionGet from '../../server/api/session.get';
import sessionPost from '../../server/api/session.post';
import setupGet from '../../server/api/setup.get';
import setupPost from '../../server/api/setup.post';
import listWorkspaces from '../../server/api/workspaces/index.get';
import { markServerStart } from '../../server/auth/setup-window';
import { setDatabase } from '../../server/utils/database';
import { setExtensionRegistry } from '../../server/utils/extensions';

import type { Dialect } from './databases';
import type { Database } from '../../server/database/types/schema';
import type { Kysely } from 'kysely';

/** The first administrator, as the tests set them up. */
export const ADMIN = { name: 'Ada', email: 'ada@homelab.example', password: 'correct horse battery' };

/** A documentation address (RFC 5737): attempts are limited per address. */
export const CLIENT_IP = '192.0.2.10';

export interface Call {
  body?: unknown;
  cookie?: string;
  ip?: string;
}

/** The account routes and one workspace route, served as the app serves them. */
const serve = () => {
  const router = createRouter()
    .get('/api/setup', setupGet)
    .post('/api/setup', setupPost)
    .get('/api/session', sessionGet)
    .post('/api/session', sessionPost)
    .delete('/api/session', sessionDelete)
    .get('/api/workspaces', listWorkspaces);
  return toWebHandler(createApp().use(router));
};

/** `name=value` of the cookie a response sets, or undefined. */
export const cookieOf = (setCookie: string | null) => setCookie?.split(';')[0];

/** A database migrated like the app's, the setup window open, and requests to the account routes. */
export function useTestAccounts(dialect: Dialect) {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;

  beforeEach(() => {
    // The defaults, whatever a developer's .env (loaded by another test file of the same worker) says.
    vi.stubEnv('SETUP_TIMEOUT_MINUTES', undefined);
    setDatabase(Promise.resolve(db()));
    setExtensionRegistry(BUILTIN_REGISTRY);
    markServerStart(new Date());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const call = async (method: string, path: string, { body, cookie, ip = CLIENT_IP }: Call = {}) => {
    const response = await serve()(new Request(`http://localhost${path}`, {
      method,
      headers: {
        'x-forwarded-for': ip,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(cookie ? { cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }));
    const text = await response.text();
    return {
      status: response.status,
      json: (text ? JSON.parse(text) : undefined) as unknown,
      headers: response.headers,
      setCookie: response.headers.get('set-cookie'),
    };
  };

  /** Sets up the administrator, without the demo unless asked; answers the response. */
  const setUp = (overrides: Record<string, unknown> = {}, ip = '192.0.2.20') =>
    call('POST', '/api/setup', { body: { ...ADMIN, demo: false, ...overrides }, ip });

  /** The administrator's session cookie, after setting them up. */
  const signedIn = async () => {
    const response = await setUp();
    const cookie = cookieOf(response.setCookie);
    if (response.status !== 201 || !cookie) {
      throw new Error(`Setup failed: ${String(response.status)} ${JSON.stringify(response.json)}`);
    }
    return cookie;
  };

  const count = async (table: 'user') => {
    const { rows } = await sql<{ n: number | string }>`select count(*) as n from ${sql.table(table)}`.execute(db());
    return Number(rows[0]?.n);
  };

  /** Whether the demo workspace exists (the test database also holds workspaces A and B). */
  const hasDemo = async () => (await db().selectFrom('workspace').select('id').where('slug', '=', 'demo').execute()).length === 1;

  return { db, call, setUp, signedIn, count, hasDemo };
}
