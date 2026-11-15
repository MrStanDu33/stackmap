import { describe, expect, it } from 'vitest';

import handler from './index.get';
import { DIALECTS } from '../../../../../../../tests/support/databases';
import { useEntityApi } from '../../../../../../../tests/support/entity-api';
import { createPortForwards } from '../../../../../../../tests/support/nat';
import { serveRoute } from '../../../../../../../tests/support/requests';
import { setExtensionsEnabled } from '../../../../../../repositories/workspace-extensions';

import type { Dialect } from '../../../../../../../tests/support/databases';

const get = serveRoute('get', '/api/workspaces/:workspaceId/extensions/:extensionId/orphans', handler);

describe.each(DIALECTS)('GET /api/workspaces/:workspaceId/extensions/:extensionId/orphans on %s', (dialect: Dialect) => {
  const { workspaces, db, signInAs } = useEntityApi(dialect);
  const path = (id = 'nat') => `/api/workspaces/${workspaces.a.workspace.id}/extensions/${id}/orphans`;
  const turnOffNat = () => setExtensionsEnabled(db(), workspaces.a.workspace.id, ['nat'], false, null);

  it('given NAT off, gives an admin the port forwards no flow is based on, with their fields (10)', async () => {
    const { forwards: [, orphan] } = await createPortForwards(workspaces.a.repos);
    await turnOffNat();
    await signInAs('admin');

    const { status, json } = await get(path());

    expect(status).toBe(200);
    expect(json).toEqual({
      items: [{
        entity: 'port-forward', id: orphan?.id,
        fields: expect.objectContaining({ externalAddress: '203.0.113.10', externalPort: 8080, transport: 'tcp' }) as unknown,
      }],
      count: 1,
      truncated: false,
    });
  });

  it('answers 409 extension_enabled when NAT is on (11)', async () => {
    await signInAs('owner');

    const { status, json } = await get(path());

    expect(status).toBe(409);
    expect(json).toMatchObject({ code: 'extension_enabled' });
  });

  it('gives an editor or viewer the count only, none of the hidden entities\' fields, and answers 404 to a non-member (12, 22, review)', async () => {
    await createPortForwards(workspaces.a.repos);
    await turnOffNat();
    for (const role of ['viewer', 'editor'] as const) {
      await signInAs(role);
      expect((await get(path())).json, role).toEqual({ items: [], count: 1, truncated: false });
    }
    await signInAs('owner', 'b');
    expect((await get(path())).status).toBe(404);
  });

  it('answers 404 extension_not_found for an id that is not installed', async () => {
    await signInAs('owner');

    const { status, json } = await get(path('tls'));

    expect(status).toBe(404);
    expect(json).toMatchObject({ code: 'extension_not_found' });
  });
});
