import { createHost } from '@stackmap/extension-core/testing';
import { describe, expect, it } from 'vitest';

import handler from './index.put';
import { DIALECTS } from '../../../../../tests/support/databases';
import { useEntityApi } from '../../../../../tests/support/entity-api';
import { serveRoute } from '../../../../../tests/support/requests';
import { extensionStates, setExtensionsEnabled } from '../../../../repositories/workspace-extensions';

import type { Dialect } from '../../../../../tests/support/databases';

const put = serveRoute('put', '/api/workspaces/:workspaceId/extensions', handler);

type Listed = { extensions: { id: string; enabled: boolean }[] };

describe.each(DIALECTS)('PUT /api/workspaces/:workspaceId/extensions on %s', (dialect: Dialect) => {
  const { workspaces, db, signInAs } = useEntityApi(dialect);
  const path = () => `/api/workspaces/${workspaces.a.workspace.id}/extensions`;
  const states = async () =>
    Object.fromEntries(await extensionStates(db(), workspaces.a.workspace.id, ['nat', 'reverse-proxy']));
  const allOn = { nat: true, 'reverse-proxy': true };

  it('lets an admin of an empty workspace turn on only NAT: 200 with the workspace\'s extensions, NAT on, reverse proxy off (9)', async () => {
    await signInAs('admin');

    const { status, json } = await put(path(), { body: { enabled: ['nat'] } });

    expect(status).toBe(200);
    expect((json as Listed).extensions.map(({ id, enabled }) => ({ id, enabled }))).toEqual([
      { id: 'core', enabled: true }, { id: 'nat', enabled: true }, { id: 'reverse-proxy', enabled: false },
    ]);
    expect(await states()).toEqual({ nat: true, 'reverse-proxy': false });
    expect(Object.fromEntries(await extensionStates(db(), workspaces.b.workspace.id, ['reverse-proxy'])))
      .toEqual({ 'reverse-proxy': true });
  });

  it('lets an owner turn every optional extension off with enabled: [], and back on (10)', async () => {
    await signInAs('owner');

    expect((await put(path(), { body: { enabled: [] } })).status).toBe(200);
    expect(await states()).toEqual({ nat: false, 'reverse-proxy': false });

    expect((await put(path(), { body: { enabled: ['nat', 'reverse-proxy'] } })).status).toBe(200);
    expect(await states()).toEqual(allOn);
  });

  it('answers 409 workspace_not_empty when the workspace holds an entity, and changes nothing (11)', async () => {
    await createHost(workspaces.a.repos);
    await setExtensionsEnabled(db(), workspaces.a.workspace.id, ['reverse-proxy'], false, null);
    await signInAs('admin');

    const { status, json } = await put(path(), { body: { enabled: ['reverse-proxy'] } });

    expect(status).toBe(409);
    expect(json).toMatchObject({ code: 'workspace_not_empty' });
    expect(await states()).toEqual({ nat: true, 'reverse-proxy': false });
  });

  it('answers 404 extension_not_found for an id that is not installed, and changes nothing (12)', async () => {
    await signInAs('owner');

    const { status, json } = await put(path(), { body: { enabled: ['nat', 'tls'] } });

    expect(status).toBe(404);
    expect(json).toMatchObject({ code: 'extension_not_found' });
    expect(await states()).toEqual(allOn);
  });

  it('answers 403 to an editor and a viewer, and changes nothing (13)', async () => {
    for (const role of ['editor', 'viewer'] as const) {
      await signInAs(role);

      const { status, json } = await put(path(), { body: { enabled: [] } });

      expect(status).toBe(403);
      expect(json).toMatchObject({ code: 'forbidden' });
    }
    expect(await states()).toEqual(allOn);
  });

  it('answers 404 to a signed-in user who is not a member, and changes nothing (13)', async () => {
    await signInAs('owner', 'b');

    expect((await put(path(), { body: { enabled: [] } })).status).toBe(404);
    expect(await states()).toEqual(allOn);
  });

  it('requires an admin of the workspace, so a request signed out answers 401 (13)', () => {
    expect(handler.contract.requiredRole).toBe('admin');
  });

  it('answers 400 to more than 100 ids, an id that is not kebab-case, or a body without enabled (14)', async () => {
    await signInAs('owner');

    for (const body of [{ enabled: Array.from({ length: 101 }, (_, n) => `x-${String(n)}`) }, { enabled: ['Not_Kebab'] }, {}]) {
      const { status, json } = await put(path(), { body });

      expect(status).toBe(400);
      expect(json).toMatchObject({ code: 'validation_failed' });
    }
    expect(await states()).toEqual(allOn);
  });
});
