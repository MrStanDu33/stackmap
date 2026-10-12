import { describe, expect, it } from 'vitest';

import { EntityInUseError, EntityValidationError, WorkspaceReferenceError } from './errors';
import { buildNetwork, createHost, createNetwork, createSite } from '../../tests/factories';
import { DIALECTS } from '../../tests/support/databases';
import { describeScopedRepository } from '../../tests/support/scoped-repository-suite';
import { BUILTIN_KINDS, countRows, useTestWorkspaces } from '../../tests/support/workspaces';
import { isForeignKeyViolation } from '../database/errors';
import { newId } from '../database/ids';

import type { KindCatalog } from './index';
import type { NetworkRepository } from './networks';
import type { Dialect } from '../../tests/support/databases';

const WITH_TOASTER: KindCatalog = { hasKind: (entity, id) => id === 'toaster' || BUILTIN_KINDS.hasKind(entity, id) };

describe.each(DIALECTS)('networks on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const networks = (): NetworkRepository => workspaces.a.repos.networks;

  describeScopedRepository({
    workspaces,
    repository: 'networks',
    table: 'network',
    input: () => Promise.resolve(buildNetwork()),
    patch: { name: 'Server VLAN', cidr: '10.0.20.0/24', vlan: 20 },
    invalid: { input: { cidr: '10.0.10.5/24', vlan: 5000 }, paths: ['cidr', 'vlan'] },
  });

  it('lists the networks of a site', async () => {
    const { repos } = workspaces.a;
    const site = await createSite(repos);
    const onSite = await createNetwork(repos, { siteId: site.id });
    await createNetwork(repos);

    expect((await networks().list({ siteId: site.id })).map(({ id }) => id)).toEqual([onSite.id]);
  });

  it('given a kind no active extension provides, fails with a validation error on kind', async () => {
    const network = await createNetwork(workspaces.a.repos);

    await expect(networks().create(buildNetwork({ kind: 'toaster' }))).rejects.toMatchObject({
      constructor: EntityValidationError,
      issues: [{ path: 'kind', message: expect.stringContaining('toaster') as unknown }],
    });
    await expect(networks().update(network.id, { kind: 'toaster' })).rejects.toBeInstanceOf(EntityValidationError);
  });

  it('given a stored kind of an extension that is no longer active, reads and updates the network', async () => {
    const { a } = workspaces;
    const network = await workspaces.repositories(a.workspace.id, { kinds: WITH_TOASTER }).networks
      .create(buildNetwork({ kind: 'toaster' }));

    expect(await networks().get(network.id)).toMatchObject({ kind: 'toaster' });
    expect(await networks().update(network.id, { name: 'Renamed' })).toMatchObject({ name: 'Renamed', kind: 'toaster' });
  });

  it('given a site of another workspace or an unknown one, fails with a reference error on siteId and writes nothing', async () => {
    const { a, b, db } = workspaces;
    const theirSite = await createSite(b.repos);
    const network = await createNetwork(a.repos);

    for (const siteId of [theirSite.id, newId()]) {
      await expect(networks().create(buildNetwork({ siteId }))).rejects.toMatchObject({
        constructor: WorkspaceReferenceError,
        field: 'siteId',
        id: siteId,
      });
      await expect(networks().update(network.id, { siteId })).rejects.toBeInstanceOf(WorkspaceReferenceError);
    }
    expect(await countRows(db, 'network', a.workspace.id)).toBe(1);
    expect(await networks().get(network.id)).toEqual(network);
  });

  it('given a direct write that pairs the workspace with another workspace\'s site, the database refuses it', async () => {
    const { a, b, db } = workspaces;
    const theirSite = await createSite(b.repos);
    const network = await createNetwork(a.repos);

    await expect(db.updateTable('network').set({ siteId: theirSite.id }).where('id', '=', network.id).execute())
      .rejects.toSatisfy(isForeignKeyViolation);
  });

  it('given a network referenced by host addresses, refuses to remove it, naming the dependents and their counts', async () => {
    const { repos } = workspaces.a;
    const network = await createNetwork(repos, { cidr: '10.0.10.0/24' });
    await createHost(repos, { addresses: [{ address: '10.0.10.20', networkId: network.id }] });

    await expect(networks().remove(network.id)).rejects.toMatchObject({
      constructor: EntityInUseError,
      dependents: [{ entity: 'hostAddress', count: 1 }],
    });
    expect(await networks().get(network.id)).toEqual(network);
  });
});
