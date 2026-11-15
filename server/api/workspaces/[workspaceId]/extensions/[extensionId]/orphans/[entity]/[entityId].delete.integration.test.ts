import { describe, expect, it } from 'vitest';

import handler from './[entityId].delete';
import { DIALECTS } from '../../../../../../../../tests/support/databases';
import { useEntityApi } from '../../../../../../../../tests/support/entity-api';
import { createPortForwards } from '../../../../../../../../tests/support/nat';
import { serveRoute } from '../../../../../../../../tests/support/requests';
import { listAuditEvents } from '../../../../../../../repositories/audit-events';
import { setExtensionsEnabled } from '../../../../../../../repositories/workspace-extensions';

import type { Dialect } from '../../../../../../../../tests/support/databases';

const remove = serveRoute('delete', '/api/workspaces/:workspaceId/extensions/:extensionId/orphans/:entity/:entityId', handler);

describe.each(DIALECTS)('DELETE …/orphans/:entity/:entityId on %s', (dialect: Dialect) => {
  const { workspaces, db, signInAs } = useEntityApi(dialect);
  const path = (entity: string, id: string) =>
    `/api/workspaces/${workspaces.a.workspace.id}/extensions/nat/orphans/${entity}/${id}`;
  const setUp = async () => {
    const created = await createPortForwards(workspaces.a.repos);
    await setExtensionsEnabled(db(), workspaces.a.workspace.id, ['nat'], false, null);
    return created;
  };

  it('lets an admin delete an orphan: 204, it is gone, and an audit event names the admin (15)', async () => {
    const { forwards: [, orphan] } = await setUp();
    const admin = await signInAs('admin');

    const { status } = await remove(path('port-forward', orphan?.id ?? ''));

    expect(status).toBe(204);
    expect(await workspaces.a.repos.portForwards.get(orphan?.id ?? '')).toBeUndefined();
    const [event] = await listAuditEvents(db(), workspaces.a.workspace.id);
    expect(event).toMatchObject({
      action: 'delete', extension: 'nat', entity: 'port-forward', entityId: orphan?.id, actorId: admin.user.id,
    });
  });

  it('answers 409 hidden_entity_connected for an entity a flow is based on, and keeps it (16)', async () => {
    const { forwards: [connected] } = await setUp();
    await signInAs('admin');

    const { status, json } = await remove(path('port-forward', connected?.id ?? ''));

    expect(status).toBe(409);
    expect(json).toMatchObject({ code: 'hidden_entity_connected' });
    expect(await workspaces.a.repos.portForwards.get(connected?.id ?? '')).toBeDefined();
  });

  it('answers 404 for an id of another workspace or a type the extension does not declare (17)', async () => {
    await setUp();
    const { forwards: [, elsewhere] } = await createPortForwards(workspaces.b.repos);
    await signInAs('admin');

    const other = await remove(path('port-forward', elsewhere?.id ?? ''));
    const type = await remove(path('host', elsewhere?.id ?? ''));

    expect(other.status).toBe(404);
    expect(other.json).toMatchObject({ code: 'entity_not_found' });
    expect(type.status).toBe(404);
    expect(type.json).toMatchObject({ code: 'entity_type_not_found' });
    expect(await workspaces.b.repos.portForwards.get(elsewhere?.id ?? '')).toBeDefined();
  });

  it('answers 409 extension_enabled when the extension is on, and 403 to an editor (11, 12)', async () => {
    const { forwards: [, orphan] } = await createPortForwards(workspaces.a.repos);
    await signInAs('admin');
    const on = await remove(path('port-forward', orphan?.id ?? ''));
    await setExtensionsEnabled(db(), workspaces.a.workspace.id, ['nat'], false, null);
    await signInAs('editor');
    const editor = await remove(path('port-forward', orphan?.id ?? ''));

    expect(on.status).toBe(409);
    expect(on.json).toMatchObject({ code: 'extension_enabled' });
    expect(editor.status).toBe(403);
    expect(await workspaces.a.repos.portForwards.get(orphan?.id ?? '')).toBeDefined();
  });
});
