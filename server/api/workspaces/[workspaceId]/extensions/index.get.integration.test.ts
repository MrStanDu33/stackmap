import { describe, expect, it } from 'vitest';

import handler from './index.get';
import { DIALECTS } from '../../../../../tests/support/databases';
import { useEntityApi } from '../../../../../tests/support/entity-api';
import { INSTALLED_EXTENSIONS } from '../../../../../tests/support/extensions';
import { serveRoute } from '../../../../../tests/support/requests';
import { BUILTIN_REGISTRY } from '../../../../../tests/support/workspaces';
import { setExtensionsEnabled } from '../../../../repositories/workspace-extensions';

import type { Dialect } from '../../../../../tests/support/databases';

const get = serveRoute('get', '/api/workspaces/:workspaceId/extensions', handler);

describe.each(DIALECTS)('GET /api/workspaces/:workspaceId/extensions on %s', (dialect: Dialect) => {
  const { workspaces, db, signInAs } = useEntityApi(dialect);
  const path = () => `/api/workspaces/${workspaces.a.workspace.id}/extensions`;

  it('gives a viewer every installed extension as GET /api/extensions does, each with enabled for this workspace (8)', async () => {
    await setExtensionsEnabled(db(), workspaces.a.workspace.id, ['nat'], false, null);
    await signInAs('viewer');

    const { status, json } = await get(path());

    expect(status).toBe(200);
    // In registry order, as GET /api/extensions lists them: dependencies first, then by id.
    expect(json).toEqual({
      extensions: BUILTIN_REGISTRY.extensions.map(({ manifest }) => ({
        ...INSTALLED_EXTENSIONS.find(({ id }) => id === manifest.id), enabled: manifest.id !== 'nat',
      })),
    });
  });

  it('lists only installed extensions, whatever else was turned off (6)', async () => {
    await setExtensionsEnabled(db(), workspaces.a.workspace.id, ['tls'], false, null);
    await signInAs('viewer');

    const { json } = await get(path());

    expect((json as { extensions: { id: string; enabled: boolean }[] }).extensions
      .map(({ id, enabled }) => ({ id, enabled }))).toEqual([
      { id: 'core', enabled: true }, { id: 'nat', enabled: true }, { id: 'reverse-proxy', enabled: true },
    ]);
  });

  it('answers 404 to a signed-in user who is not a member (9)', async () => {
    await signInAs('owner', 'b');

    expect((await get(path())).status).toBe(404);
  });
});
