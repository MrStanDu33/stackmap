import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { request } from '@playwright/test';
import { hashPassword } from 'better-auth/crypto';
import Database from 'better-sqlite3';

import { ADMIN, dataDirVariable, DEMO_SESSION, DEMO_URL, EMPTY_URL, USER } from './support/accounts';

/** Writes the plain user into a server's database, as Better Auth stores an email and password account on SQLite. */
async function addPlainUser(url: string): Promise<void> {
  const dir = process.env[dataDirVariable(new URL(url).port)];
  if (!dir) {
    throw new Error(`No data directory for ${url}.`);
  }
  const db = new Database(join(dir, 'stackmap.sqlite'));
  try {
    const now = new Date().toISOString();
    const id = randomUUID();
    db.prepare('insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role) values (?, ?, ?, 0, ?, ?, ?)')
      .run(id, USER.name, USER.email, now, now, 'user');
    db.prepare('insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") '
      + 'values (?, ?, ?, ?, ?, ?, ?)')
      .run(randomUUID(), id, 'credential', id, await hashPassword(USER.password), now, now);
  } finally {
    db.close();
  }
}

/**
 * Sets up the administrator on the demo and empty servers, adds the plain user there, and keeps the demo server's
 * session for the tests.
 */
export default async function globalSetup(): Promise<void> {
  for (const url of [DEMO_URL, EMPTY_URL]) {
    const context = await request.newContext({ baseURL: url });
    // The demo server seeds the demo at boot (STACKMAP_DEMO=true); the other has none.
    const response = await context.post('/api/setup', { data: { ...ADMIN, demo: false } });
    if (response.status() !== 201) {
      throw new Error(`Setup of ${url} failed: ${String(response.status())} ${await response.text()}`);
    }
    await addPlainUser(url);
    if (url === DEMO_URL) {
      await context.storageState({ path: DEMO_SESSION });
    }
    await context.dispose();
  }
}
