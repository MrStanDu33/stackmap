import { describe, expect, it } from 'vitest';

import handler from './[extensionId].put';
import { DIALECTS } from '../../../../../tests/support/databases';
import { useEntityApi } from '../../../../../tests/support/entity-api';
import { serveRoute } from '../../../../../tests/support/requests';
import { extensionStates, setExtensionsEnabled } from '../../../../repositories/workspace-extensions';

import type { Dialect } from '../../../../../tests/support/databases';

const put = serveRoute('put', '/api/workspaces/:workspaceId/extensions/:extensionId', handler);

describe.each(DIALECTS)('PUT /api/workspaces/:workspaceId/extensions/:extensionId on %s', (dialect: Dialect) => {
  const { workspaces, db, signInAs } = useEntityApi(dialect);
  const path = (id: string) => `/api/workspaces/${workspaces.a.workspace.id}/extensions/${id}`;
  const natEnabled = async () =>
    (await extensionStates(db(), workspaces.a.workspace.id, ['nat'])).get('nat');

  it('answers 404 to a signed-in user who is not a member, and changes nothing (9)', async () => {
    await signInAs('owner', 'b');

    expect((await put(path('nat'), { body: { enabled: false } })).status).toBe(404);
    expect(await natEnabled()).toBe(true);
  });

  it('answers 403 to an editor, and changes nothing (10)', async () => {
    await signInAs('editor');

    const { status, json } = await put(path('nat'), { body: { enabled: false } });

    expect(status).toBe(403);
    expect(json).toMatchObject({ code: 'forbidden' });
    expect(await natEnabled()).toBe(true);
  });

  it('lets an admin turn NAT off: 200 with what changed, and NAT is off in the workspace (11)', async () => {
    await signInAs('admin');

    const { status, json } = await put(path('nat'), { body: { enabled: false } });

    expect(status).toBe(200);
    expect(json).toEqual({ changed: [{ id: 'nat', enabled: false }] });
    expect(await natEnabled()).toBe(false);
    expect((await extensionStates(db(), workspaces.b.workspace.id, ['nat'])).get('nat')).toBe(true);
  });

  it('lets an owner turn NAT back on (11)', async () => {
    await setExtensionsEnabled(db(), workspaces.a.workspace.id, ['nat'], false, null);
    await signInAs('owner');

    const { status, json } = await put(path('nat'), { body: { enabled: true } });

    expect(status).toBe(200);
    expect(json).toEqual({ changed: [{ id: 'nat', enabled: true }] });
    expect(await natEnabled()).toBe(true);
  });

  it('answers 200 with nothing changed when NAT is already off (12)', async () => {
    await setExtensionsEnabled(db(), workspaces.a.workspace.id, ['nat'], false, null);
    await signInAs('admin');

    const { status, json } = await put(path('nat'), { body: { enabled: false } });

    expect(status).toBe(200);
    expect(json).toEqual({ changed: [] });
  });

  it('answers 409 extension_always_on when an owner turns the core off (13)', async () => {
    await signInAs('owner');

    const { status, json } = await put(path('core'), { body: { enabled: false } });

    expect(status).toBe(409);
    expect(json).toMatchObject({ code: 'extension_always_on' });
  });

  it('answers 404 extension_not_found for an id that is not installed (14)', async () => {
    await signInAs('owner');

    const { status, json } = await put(path('tls'), { body: { enabled: false } });

    expect(status).toBe(404);
    expect(json).toMatchObject({ code: 'extension_not_found' });
    expect((await extensionStates(db(), workspaces.a.workspace.id, ['tls'])).get('tls')).toBe(true);
  });

  it('refuses a body with anything but enabled (edge case)', async () => {
    await signInAs('owner');

    const { status, json } = await put(path('nat'), { body: { enabled: false, extension: 'core' } });

    expect(status).toBe(400);
    expect(json).toMatchObject({ code: 'validation_failed' });
    expect(await natEnabled()).toBe(true);
  });
});
