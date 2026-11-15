import { describe, expect, it } from 'vitest';

import handler from './impact.get';
import { DIALECTS } from '../../../../../../tests/support/databases';
import { useEntityApi } from '../../../../../../tests/support/entity-api';
import { createPortForwards } from '../../../../../../tests/support/nat';
import { serveRoute } from '../../../../../../tests/support/requests';
import { extensionStates, setExtensionsEnabled } from '../../../../../repositories/workspace-extensions';

import type { Dialect } from '../../../../../../tests/support/databases';

const get = serveRoute('get', '/api/workspaces/:workspaceId/extensions/:extensionId/impact', handler);

describe.each(DIALECTS)('GET /api/workspaces/:workspaceId/extensions/:extensionId/impact on %s', (dialect: Dialect) => {
  const { workspaces, db, signInAs } = useEntityApi(dialect);
  const path = (id: string, enabled: boolean) =>
    `/api/workspaces/${workspaces.a.workspace.id}/extensions/${id}/impact?enabled=${String(enabled)}`;

  it('gives a viewer the extensions that would go off, with their entities per type and the flows they derive (15)', async () => {
    await createPortForwards(workspaces.a.repos);
    // Workspace B's forwards are not counted.
    await createPortForwards(workspaces.b.repos);
    await signInAs('viewer');

    const { status, json } = await get(path('nat', false));

    expect(status).toBe(200);
    expect(json).toEqual({
      changes: [{ id: 'nat', enabled: false, entities: [{ entity: 'port-forward', count: 2 }], derivedFlows: 1 }],
    });
    expect((await extensionStates(db(), workspaces.a.workspace.id, ['nat'])).get('nat')).toBe(true);
  });

  it('counts zero for an extension without entities', async () => {
    await signInAs('viewer');

    const { json } = await get(path('reverse-proxy', false));

    expect(json).toEqual({
      changes: [{ id: 'reverse-proxy', enabled: false, entities: [{ entity: 'route', count: 0 }], derivedFlows: 0 }],
    });
  });

  it('lists the dependencies that would come on with an extension, with no counts (16)', async () => {
    await createPortForwards(workspaces.a.repos);
    await setExtensionsEnabled(db(), workspaces.a.workspace.id, ['nat'], false, null);
    await signInAs('viewer');

    const { status, json } = await get(path('nat', true));

    expect(status).toBe(200);
    expect(json).toEqual({ changes: [{ id: 'nat', enabled: true, entities: [], derivedFlows: 0 }] });
  });

  it('answers 404 to a signed-in user who is not a member (9)', async () => {
    await signInAs('owner', 'b');

    expect((await get(path('nat', false))).status).toBe(404);
  });

  it('answers 409 extension_always_on for the core and 404 extension_not_found for an unknown id (13, 14)', async () => {
    await signInAs('owner');

    const core = await get(path('core', false));
    const unknown = await get(path('tls', false));

    expect(core.status).toBe(409);
    expect(core.json).toMatchObject({ code: 'extension_always_on' });
    expect(unknown.status).toBe(404);
    expect(unknown.json).toMatchObject({ code: 'extension_not_found' });
  });
});
