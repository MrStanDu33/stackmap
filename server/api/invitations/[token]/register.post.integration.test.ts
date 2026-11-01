import { beforeEach, describe, expect, it } from 'vitest';

import handler from './register.post';
import { createMember } from '../../../../tests/support/accounts';
import { DIALECTS } from '../../../../tests/support/databases';
import { serveRoute } from '../../../../tests/support/requests';
import { useTestWorkspaces } from '../../../../tests/support/workspaces';
import { createInvitation, findInvitation } from '../../../repositories/invitations';
import { useAuth } from '../../../utils/auth';
import { setDatabase } from '../../../utils/database';

import type { Dialect } from '../../../../tests/support/databases';
import type { Database } from '../../../database/types/schema';
import type { Kysely } from 'kysely';

const post = serveRoute('post', '/api/invitations/:token/register', handler);
const PASSWORD = 'correct horse battery';

describe.each(DIALECTS)('POST /api/invitations/:token/register on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const invite = async (email = 'alan@homelab.example') => {
    const ada = await createMember(db(), workspaces.a.workspace.id, 'owner', { name: 'Ada', email: 'ada@homelab.example' });
    return createInvitation(db(), { workspaceId: workspaces.a.workspace.id, email, role: 'editor', invitedById: ada.user.id });
  };
  const signIn = async (email: string, password: string) => {
    try {
      await (await useAuth()).api.signInEmail({ body: { email, password } });
      return true;
    } catch {
      return false;
    }
  };

  beforeEach(() => {
    setDatabase(Promise.resolve(db()));
  });

  it('given no account for the invited email, creates it, answers 202 with no cookie, and keeps the invitation for accepting (8)', async () => {
    const { token } = await invite();

    const { status, json, headers } = await post(`/api/invitations/${token}/register`, { body: { name: 'Alan', password: PASSWORD } });

    expect(status).toBe(202);
    expect(json).toBeNull();
    expect(headers.get('set-cookie')).toBeNull();
    const account = await db().selectFrom('user').select(['name', 'role']).where('email', '=', 'alan@homelab.example').executeTakeFirst();
    expect(account).toEqual({ name: 'Alan', role: 'user' });
    expect(await signIn('alan@homelab.example', PASSWORD)).toBe(true);
    expect(await findInvitation(db(), token)).toBeDefined();
  });

  it('given an account for the invited email, answers the same 202 and changes nothing (9)', async () => {
    const { token } = await invite('ada@homelab.example');

    const { status, json, headers } = await post(`/api/invitations/${token}/register`, { body: { name: 'Mallory', password: 'another password 123' } });

    expect({ status, json, cookie: headers.get('set-cookie') }).toEqual({ status: 202, json: null, cookie: null });
    expect(await db().selectFrom('user').select('name').where('email', '=', 'ada@homelab.example').executeTakeFirst())
      .toEqual({ name: 'Ada' });
    expect(await signIn('ada@homelab.example', 'another password 123')).toBe(false);
    expect(await findInvitation(db(), token)).toBeDefined();
  });

  it('given 5 attempts from one address within a minute, answers the 6th 429 (11)', async () => {
    const { token } = await invite();
    // Valid requests: an invalid one is refused before its attempt is counted.
    const attempt = () => post(`/api/invitations/${token}/register`, { body: { name: 'Alan', password: PASSWORD }, ip: '192.0.2.77' });

    for (let n = 0; n < 5; n += 1) {
      expect((await attempt()).status).toBe(202);
    }
    const sixth = await attempt();
    expect(sixth.status).toBe(429);
    expect(sixth.headers.get('retry-after')).toMatch(/^\d+$/);
  });
});
