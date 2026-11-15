import { describe, expect, it } from 'vitest';

import handler from './kept.put';
import { DIALECTS } from '../../../../../../../../../tests/support/databases';
import { useEntityApi } from '../../../../../../../../../tests/support/entity-api';
import { createPortForwards } from '../../../../../../../../../tests/support/nat';
import { serveRoute } from '../../../../../../../../../tests/support/requests';
import { BUILTIN_REGISTRY } from '../../../../../../../../../tests/support/workspaces';
import { listHiddenOrphans } from '../../../../../../../../repositories/hidden-orphans';
import { setExtensionsEnabled } from '../../../../../../../../repositories/workspace-extensions';

import type { Dialect } from '../../../../../../../../../tests/support/databases';

const put = serveRoute('put', '/api/workspaces/:workspaceId/extensions/:extensionId/orphans/:entity/:entityId/kept', handler);
const NAT = BUILTIN_REGISTRY.repositories().filter(({ extension }) => extension === 'nat');

describe.each(DIALECTS)('PUT …/orphans/:entity/:entityId/kept on %s', (dialect: Dialect) => {
  const { workspaces, db, signInAs } = useEntityApi(dialect);
  const path = (entity: string, id: string, workspaceId = workspaces.a.workspace.id) =>
    `/api/workspaces/${workspaceId}/extensions/nat/orphans/${entity}/${id}/kept`;
  const setUp = async () => {
    const created = await createPortForwards(workspaces.a.repos);
    await setExtensionsEnabled(db(), workspaces.a.workspace.id, ['nat'], false, null);
    return created;
  };
  const orphans = async () => (await listHiddenOrphans(
    { db: db(), repos: workspaces.a.repos, workspaceId: workspaces.a.workspace.id }, NAT,
  )).items.map(({ id }) => id);

  it('lets an admin keep an orphan hidden: 204, and it leaves the list (14)', async () => {
    const { forwards: [, orphan] } = await setUp();
    await signInAs('admin');

    const { status } = await put(path('port-forward', orphan?.id ?? ''));

    expect(status).toBe(204);
    expect(await orphans()).toEqual([]);
    expect(await workspaces.a.repos.portForwards.get(orphan?.id ?? '')).toBeDefined();
  });

  it('answers 409 hidden_entity_connected for an entity a flow is based on (16)', async () => {
    const { forwards: [connected] } = await setUp();
    await signInAs('admin');

    const { status, json } = await put(path('port-forward', connected?.id ?? ''));

    expect(status).toBe(409);
    expect(json).toMatchObject({ code: 'hidden_entity_connected' });
  });

  it('answers 404 for an id of another workspace or a type the extension does not declare (17)', async () => {
    await setUp();
    const { forwards: [, elsewhere] } = await createPortForwards(workspaces.b.repos);
    await signInAs('admin');

    const other = await put(path('port-forward', elsewhere?.id ?? ''));
    const type = await put(path('host', elsewhere?.id ?? ''));

    expect(other.status).toBe(404);
    expect(other.json).toMatchObject({ code: 'entity_not_found' });
    expect(type.status).toBe(404);
    expect(type.json).toMatchObject({ code: 'entity_type_not_found' });
  });

  it('answers 403 to an editor (12)', async () => {
    const { forwards: [, orphan] } = await setUp();
    await signInAs('editor');

    expect((await put(path('port-forward', orphan?.id ?? ''))).status).toBe(403);
    expect(await orphans()).toEqual([orphan?.id]);
  });
});
