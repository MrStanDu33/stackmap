import { describe, expect, it } from 'vitest';

import { deleteOrphan, isConnected, keepHiddenEntity, listHiddenOrphans, MAX_ORPHANS } from './hidden-orphans';
import { setExtensionsEnabled } from './workspace-extensions';
import { createAccount } from '../../tests/support/accounts';
import { DIALECTS } from '../../tests/support/databases';
import { createPortForwards } from '../../tests/support/nat';
import { BUILTIN_REGISTRY, useTestWorkspaces } from '../../tests/support/workspaces';

import type { Dialect } from '../../tests/support/databases';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

const NAT = BUILTIN_REGISTRY.repositories().filter(({ extension }) => extension === 'nat');

describe.each(DIALECTS)('hidden orphans on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const orphansOf = (key: 'a' | 'b' = 'a') => listHiddenOrphans(
    { db: db(), repos: workspaces[key].repos, workspaceId: workspaces[key].workspace.id }, NAT,
  );

  it('lists a turned-off extension\'s entities that no derived flow is based on (10)', async () => {
    // The :443 forward reaches a listener, so a flow is based on it; the :8080 one reaches nothing.
    const { forwards: [connected, orphan] } = await createPortForwards(workspaces.a.repos);

    const { items, truncated } = await orphansOf();

    expect(items).toEqual([{ entity: 'port-forward', id: orphan?.id, fields: expect.objectContaining({ externalPort: 8080 }) as unknown }]);
    expect(truncated).toBe(false);
    expect(await isConnected(db(), workspaces.a.workspace.id, 'port-forward', connected?.id ?? '')).toBe(true);
    expect(await isConnected(db(), workspaces.a.workspace.id, 'port-forward', orphan?.id ?? '')).toBe(false);
  });

  it('sends dates as ISO strings and leaves the workspace out of the fields', async () => {
    await createPortForwards(workspaces.a.repos);

    const [orphan] = (await orphansOf()).items;

    expect(orphan?.fields).not.toHaveProperty('workspaceId');
    expect(orphan?.fields.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('leaves out entities marked kept (13)', async () => {
    const { forwards: [, orphan] } = await createPortForwards(workspaces.a.repos);

    await keepHiddenEntity(db(), workspaces.a.workspace.id, { extension: 'nat', entity: 'port-forward', id: orphan?.id ?? '' }, null);

    expect((await orphansOf()).items).toEqual([]);
  });

  it('marks an entity kept once, recording who and when; marking it again changes nothing (14)', async () => {
    const { forwards: [, orphan] } = await createPortForwards(workspaces.a.repos);
    const ada = await createAccount(db(), { name: 'Ada', email: 'ada@homelab.example' });
    const mark = { extension: 'nat', entity: 'port-forward', id: orphan?.id ?? '' };

    await keepHiddenEntity(db(), workspaces.a.workspace.id, mark, ada.user.id);
    await keepHiddenEntity(db(), workspaces.a.workspace.id, mark, null);

    const rows = await db().selectFrom('workspace_hidden_entity_kept').select(['entityId', 'keptBy', 'keptAt']).execute();
    expect(rows.map(({ entityId, keptBy }) => ({ entityId, keptBy })))
      .toEqual([{ entityId: orphan?.id, keptBy: ada.user.id }]);
    expect(rows[0]?.keptAt).toBeTruthy();
  });

  it('clears an extension\'s kept marks when it is turned back on (18)', async () => {
    const { forwards: [, orphan] } = await createPortForwards(workspaces.a.repos);
    const { id } = workspaces.a.workspace;
    await setExtensionsEnabled(db(), id, ['nat'], false, null);
    await keepHiddenEntity(db(), id, { extension: 'nat', entity: 'port-forward', id: orphan?.id ?? '' }, null);

    await setExtensionsEnabled(db(), id, ['nat'], true, null);
    await setExtensionsEnabled(db(), id, ['nat'], false, null);

    expect((await orphansOf()).items.map((item) => item.id)).toEqual([orphan?.id]);
  });

  it('keeps another workspace\'s entities and marks out', async () => {
    const { forwards: [, orphanA] } = await createPortForwards(workspaces.a.repos);
    const { forwards: [, orphanB] } = await createPortForwards(workspaces.b.repos);
    await keepHiddenEntity(db(), workspaces.b.workspace.id, { extension: 'nat', entity: 'port-forward', id: orphanA?.id ?? '' }, null);

    expect((await orphansOf('a')).items.map(({ id }) => id)).toEqual([orphanA?.id]);
    expect((await orphansOf('b')).items.map(({ id }) => id)).toEqual([orphanB?.id]);
  });

  it('lists at most MAX_ORPHANS per entity type and says when there are more', async () => {
    const { router } = await createPortForwards(workspaces.a.repos);
    for (let port = 10_000; port < 10_000 + MAX_ORPHANS; port += 1) {
      await workspaces.a.repos.portForwards.create({
        hostId: router.id, externalAddress: '203.0.113.10', externalPort: port, transport: 'tcp',
        internalAddress: '10.0.10.20', internalPort: port,
      });
    }

    const { items, truncated } = await orphansOf();

    expect(items).toHaveLength(MAX_ORPHANS);
    expect(truncated).toBe(true);
  });

  it('deletes an orphan only if, inside the deletion, its extension is still off and no flow is based on it (review)', async () => {
    const { forwards: [connected, orphan] } = await createPortForwards(workspaces.a.repos);
    const { id } = workspaces.a.workspace;
    const workspace = { db: db(), repos: workspaces.a.repos, workspaceId: id };
    const [definition] = NAT;
    await setExtensionsEnabled(db(), id, ['nat'], false, null);

    await expect(deleteOrphan(workspace, definition!, connected?.id ?? '')).resolves.toBe('hidden_entity_connected');
    await setExtensionsEnabled(db(), id, ['nat'], true, null);
    await expect(deleteOrphan(workspace, definition!, orphan?.id ?? '')).resolves.toBe('extension_enabled');
    await setExtensionsEnabled(db(), id, ['nat'], false, null);
    await expect(deleteOrphan(workspace, definition!, orphan?.id ?? '')).resolves.toBe('deleted');
    await expect(deleteOrphan(workspace, definition!, orphan?.id ?? '')).resolves.toBe('entity_not_found');
    expect(await workspaces.a.repos.portForwards.count({})).toBe(1);
  });
});
