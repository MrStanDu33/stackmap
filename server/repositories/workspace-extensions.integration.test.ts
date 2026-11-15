import { describe, expect, it } from 'vitest';

import { extensionStates, setExtensionsEnabled } from './workspace-extensions';
import { deleteWorkspace } from './workspaces';
import { createAccount } from '../../tests/support/accounts';
import { DIALECTS } from '../../tests/support/databases';
import { useTestWorkspaces } from '../../tests/support/workspaces';

import type { Dialect } from '../../tests/support/databases';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

const INSTALLED = ['core', 'reverse-proxy', 'nat'];

describe.each(DIALECTS)('workspace extension choices on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;

  const states = async (workspaceId: string, ids = INSTALLED) =>
    Object.fromEntries(await extensionStates(db(), workspaceId, ids));

  it('given no stored choice, every installed extension is enabled (1)', async () => {
    expect(await states(workspaces.a.workspace.id)).toEqual({ core: true, 'reverse-proxy': true, nat: true });
  });

  it('given NAT turned off in workspace A, NAT is still enabled in workspace B (2)', async () => {
    await setExtensionsEnabled(db(), workspaces.a.workspace.id, ['nat'], false, null);

    expect(await states(workspaces.a.workspace.id)).toEqual({ core: true, 'reverse-proxy': true, nat: false });
    expect(await states(workspaces.b.workspace.id)).toEqual({ core: true, 'reverse-proxy': true, nat: true });
  });

  it('given a stored choice for an extension no longer installed, keeps it, so reinstalling it finds it off (6)', async () => {
    await setExtensionsEnabled(db(), workspaces.a.workspace.id, ['tls'], false, null);

    expect(await states(workspaces.a.workspace.id)).toEqual({ core: true, 'reverse-proxy': true, nat: true });
    expect(await states(workspaces.a.workspace.id, [...INSTALLED, 'tls'])).toMatchObject({ tls: false });
  });

  it('deletes the stored choices with their workspace (7)', async () => {
    const { id } = workspaces.a.workspace;
    await setExtensionsEnabled(db(), id, ['nat', 'reverse-proxy'], false, null);

    await deleteWorkspace(db(), id);

    const rows = await db().selectFrom('workspace_extension_disabled').select('extension').where('workspaceId', '=', id)
      .execute();
    expect(rows).toEqual([]);
  });

  it('turns several extensions on or off in one transaction, recording who turned them off and when', async () => {
    const { id } = workspaces.a.workspace;
    const ada = await createAccount(db(), { name: 'Ada', email: 'ada@homelab.example' });
    const before = Date.now();

    await setExtensionsEnabled(db(), id, ['nat', 'reverse-proxy'], false, ada.user.id);
    await setExtensionsEnabled(db(), id, ['nat', 'reverse-proxy'], false, null);

    const rows = await db().selectFrom('workspace_extension_disabled').select(['extension', 'disabledBy', 'disabledAt'])
      .where('workspaceId', '=', id).orderBy('extension').execute();
    // Turning off again keeps who first did it.
    expect(rows.map(({ extension, disabledBy }) => ({ extension, disabledBy }))).toEqual([
      { extension: 'nat', disabledBy: ada.user.id }, { extension: 'reverse-proxy', disabledBy: ada.user.id },
    ]);
    expect(rows.every(({ disabledAt }) => new Date(disabledAt).getTime() >= before - 1000)).toBe(true);

    await setExtensionsEnabled(db(), id, ['nat', 'reverse-proxy'], true, ada.user.id);
    expect(await states(id)).toEqual({ core: true, 'reverse-proxy': true, nat: true });
  });

  it('forgets who turned an extension off when their account is removed', async () => {
    const { id } = workspaces.a.workspace;
    const ada = await createAccount(db(), { name: 'Ada', email: 'ada@homelab.example' });
    await setExtensionsEnabled(db(), id, ['nat'], false, ada.user.id);

    await db().deleteFrom('user').where('id', '=', ada.user.id).execute();

    expect(await states(id)).toMatchObject({ nat: false });
  });
});
