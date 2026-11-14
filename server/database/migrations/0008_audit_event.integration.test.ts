import { createSite } from '@stackmap/extension-core/testing';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { createAccount } from '../../../tests/support/accounts';
import { DIALECTS } from '../../../tests/support/databases';
import { useTestWorkspaces } from '../../../tests/support/workspaces';
import { listAuditEvents } from '../../repositories/audit-events';

import type { Dialect } from '../../../tests/support/databases';
import type { Database } from '../types/schema';
import type { Kysely } from 'kysely';

describe.each(DIALECTS)('migration 0008_audit_event on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;

  it('deletes a workspace\'s audit events with the workspace (32)', async () => {
    await createSite(workspaces.a.repos);
    await createSite(workspaces.b.repos);

    await sql`delete from ${sql.table('workspace')} where id = ${workspaces.a.workspace.id}`.execute(db());

    const { rows } = await sql<{ workspaceId: string }>`select ${sql.ref('workspaceId')} from ${sql.table('audit_event')}`
      .execute(db());
    expect(rows.map(({ workspaceId }) => workspaceId)).toEqual([workspaces.b.workspace.id]);
  });

  it('keeps a deleted user\'s events with the actor set to null (32)', async () => {
    const grace = await createAccount(db(), { name: 'Grace', email: 'grace@homelab.example' });
    const asGrace = workspaces.repositories(workspaces.a.workspace.id, { actorId: grace.user.id });
    const site = await createSite(asGrace);

    await sql`delete from ${sql.table('user')} where id = ${grace.user.id}`.execute(db());

    expect(await listAuditEvents(db(), workspaces.a.workspace.id))
      .toMatchObject([{ entityId: site.id, actorId: null, action: 'create' }]);
  });
});
