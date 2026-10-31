import { describe, expect, it, vi } from 'vitest';

import { ADMIN, cookieOf, useTestAccounts } from '../../tests/support/accounts';
import { DIALECTS } from '../../tests/support/databases';
import { markServerStart } from '../auth/setup-window';

import type { Dialect } from '../../tests/support/databases';

const seed = vi.hoisted(() => ({ fails: false }));

vi.mock('../demo/seed-demo-workspace', async (importOriginal) => {
  const original = await importOriginal<typeof import('../demo/seed-demo-workspace')>();
  return {
    ...original,
    seedDemoWorkspace: (...args: Parameters<typeof original.seedDemoWorkspace>) => (seed.fails
      ? Promise.reject(new Error('Seed failed'))
      : original.seedDemoWorkspace(...args)),
  };
});

describe.each(DIALECTS)('POST /api/setup on %s', (dialect: Dialect) => {
  const accounts = useTestAccounts(dialect);

  it('given a name, email and password with demo, creates the instance admin, signs them in and seeds the demo workspace (2)', async () => {
    const { status, json, setCookie } = await accounts.setUp({ demo: true });

    expect(status).toBe(201);
    expect(json).toEqual({ user: { id: expect.any(String) as unknown, name: ADMIN.name, email: ADMIN.email, role: 'admin' } });
    const session = await accounts.call('GET', '/api/session', { cookie: cookieOf(setCookie) });
    expect(session.json).toEqual(json);
    expect(await accounts.count('workspace')).toBe(1);
  });

  it('given demo false, creates the admin and no workspace (3)', async () => {
    expect((await accounts.setUp()).status).toBe(201);

    expect(await accounts.count('user')).toBe(1);
    expect(await accounts.count('workspace')).toBe(0);
  });

  it('given an account exists, answers 409 already_set_up and changes nothing (4)', async () => {
    await accounts.signedIn();

    const { status, json } = await accounts.setUp({ email: 'grace@homelab.example' });

    expect(status).toBe(409);
    expect(json).toMatchObject({ code: 'already_set_up' });
    expect(await accounts.count('user')).toBe(1);
  });

  it('given two concurrent requests, creates exactly one admin and answers the other 409 already_set_up (5)', async () => {
    const responses = await Promise.all([
      accounts.setUp({ email: 'ada@homelab.example' }, '192.0.2.21'),
      accounts.setUp({ email: 'grace@homelab.example' }, '192.0.2.22'),
    ]);

    expect(responses.map(({ status }) => status).toSorted()).toEqual([201, 409]);
    expect(await accounts.count('user')).toBe(1);
  });

  it('given the setup window has passed, answers 403 setup_closed (6)', async () => {
    markServerStart(new Date(Date.now() - 16 * 60_000));

    const { status, json } = await accounts.setUp();

    expect(status).toBe(403);
    expect(json).toMatchObject({ code: 'setup_closed' });
    expect(await accounts.count('user')).toBe(0);
  });

  it('given an invalid email, a password under 12 characters or no name, answers 400 validation_failed with the issues (7)', async () => {
    const { status, json } = await accounts.setUp({ name: '', email: 'ada', password: 'short' });

    expect(status).toBe(400);
    expect((json as { issues: { path: string }[] }).issues.map(({ path }) => path).toSorted())
      .toEqual(['body.email', 'body.name', 'body.password']);
    expect(await accounts.count('user')).toBe(0);
  });

  it('given a demo seed that fails, still creates and signs in the admin, and logs the failure', async () => {
    seed.fails = true;
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { status, setCookie } = await accounts.setUp({ demo: true });

      expect(status).toBe(201);
      expect((await accounts.call('GET', '/api/session', { cookie: cookieOf(setCookie) })).json).not.toBeNull();
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Seed failed'));
    } finally {
      seed.fails = false;
      error.mockRestore();
    }
  });

  it('given 5 attempts from one address within a minute, answers the 6th 429 too_many_requests with Retry-After', async () => {
    const statuses = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      statuses.push((await accounts.setUp({}, '192.0.2.30')).status);
    }
    const sixth = await accounts.setUp({}, '192.0.2.30');

    expect(statuses).not.toContain(429);
    expect(sixth.status).toBe(429);
    expect(sixth.json).toMatchObject({ code: 'too_many_requests' });
    expect(Number(sixth.headers.get('retry-after'))).toBeGreaterThan(0);
  });
});
