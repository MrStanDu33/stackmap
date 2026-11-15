import { createSite } from '@stackmap/extension-core/testing';
import { describe, expect, it } from 'vitest';

import { listAuditEvents } from './audit-events';
import { DIALECTS } from '../../tests/support/databases';
import { useTestWorkspaces } from '../../tests/support/workspaces';

import type { Dialect } from '../../tests/support/databases';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

describe.each(DIALECTS)('audit events on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;

  it('reads only the scope\'s workspace\'s events, newest first (33)', async () => {
    const first = await createSite(workspaces.a.repos, { name: 'Home' });
    const second = await createSite(workspaces.a.repos, { name: 'Office' });
    await createSite(workspaces.b.repos, { name: 'Elsewhere' });

    const events = await listAuditEvents(db(), workspaces.a.workspace.id);

    expect(events.map(({ entityId }) => entityId)).toEqual([second.id, first.id]);
  });

  it('reads at most the limit it is given', async () => {
    for (let index = 0; index < 3; index += 1) {
      await createSite(workspaces.a.repos, { name: `Site ${String(index)}` });
    }

    expect(await listAuditEvents(db(), workspaces.a.workspace.id, { limit: 2 })).toHaveLength(2);
  });
});
