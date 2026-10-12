import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EntityInUseError, EntityValidationError, WorkspaceReferenceError } from './errors';
import { buildHost, createHost, createNetwork, createService, createSite } from '../../tests/factories';
import { DIALECTS } from '../../tests/support/databases';
import { describeScopedRepository } from '../../tests/support/scoped-repository-suite';
import { BUILTIN_KINDS, countRows, useTestWorkspaces } from '../../tests/support/workspaces';
import { isForeignKeyViolation } from '../database/errors';
import { newId } from '../database/ids';

import type { HostRepository } from './hosts';
import type { KindCatalog } from './index';
import type { Dialect } from '../../tests/support/databases';

const WITH_TOASTER: KindCatalog = { hasKind: (entity, id) => id === 'toaster' || BUILTIN_KINDS.hasKind(entity, id) };

describe.each(DIALECTS)('hosts on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const hosts = (): HostRepository => workspaces.a.repos.hosts;

  describeScopedRepository({
    workspaces,
    repository: 'hosts',
    table: 'host',
    input: () => Promise.resolve(buildHost()),
    patch: { name: 'Home server', kind: 'physical', os: 'Debian 13' },
    invalid: { input: { kind: 'Not Kebab', addresses: [{ address: 'server.homelab.example' }] }, paths: ['kind', 'addresses.0.address'] },
  });

  it('lists the hosts of a site', async () => {
    const { repos } = workspaces.a;
    const site = await createSite(repos);
    const onSite = await createHost(repos, { siteId: site.id });
    await createHost(repos);

    expect((await hosts().list({ siteId: site.id })).map(({ id }) => id)).toEqual([onSite.id]);
  });

  it('given another workspace\'s site as a filter, lists nothing', async () => {
    const theirSite = await createSite(workspaces.b.repos);
    await createHost(workspaces.b.repos, { siteId: theirSite.id });

    expect(await hosts().list({ siteId: theirSite.id })).toEqual([]);
  });

  it('given a malformed or unknown filter, fails with a validation error', async () => {
    for (const filter of [{ siteId: 'not-an-id' }, { siteId: ['a', 'b'] }, { name: 'Home server' }]) {
      await expect(hosts().list(filter as never)).rejects.toBeInstanceOf(EntityValidationError);
    }
  });

  it('given a kind no active extension provides, fails with a validation error on kind', async () => {
    const host = await createHost(workspaces.a.repos);

    await expect(hosts().create(buildHost({ kind: 'toaster' }))).rejects.toMatchObject({
      constructor: EntityValidationError,
      issues: [{ path: 'kind', message: expect.stringContaining('toaster') as unknown }],
    });
    await expect(hosts().update(host.id, { kind: 'toaster' })).rejects.toBeInstanceOf(EntityValidationError);
  });

  it('given a stored kind of an extension that is no longer active, reads and updates the host', async () => {
    const { a } = workspaces;
    const host = await workspaces.repositories(a.workspace.id, { kinds: WITH_TOASTER }).hosts.create(buildHost({ kind: 'toaster' }));

    expect(await hosts().get(host.id)).toMatchObject({ kind: 'toaster' });
    expect(await hosts().update(host.id, { name: 'Renamed' })).toMatchObject({ name: 'Renamed', kind: 'toaster' });
  });

  it('given a site of another workspace or an unknown one, fails with a reference error on siteId and writes nothing', async () => {
    const { a, b, db } = workspaces;
    const theirSite = await createSite(b.repos);
    const host = await createHost(a.repos);

    for (const siteId of [theirSite.id, newId()]) {
      await expect(hosts().create(buildHost({ siteId }))).rejects.toMatchObject({
        constructor: WorkspaceReferenceError,
        field: 'siteId',
        id: siteId,
      });
      await expect(hosts().update(host.id, { siteId })).rejects.toBeInstanceOf(WorkspaceReferenceError);
    }
    expect(await countRows(db, 'host', a.workspace.id)).toBe(1);
    expect(await hosts().get(host.id)).toEqual(host);
  });

  it('given a direct write that pairs the workspace with another workspace\'s site, the database refuses it', async () => {
    const { a, b, db } = workspaces;
    const theirSite = await createSite(b.repos);
    const host = await createHost(a.repos);

    await expect(db.updateTable('host').set({ siteId: theirSite.id }).where('id', '=', host.id).execute())
      .rejects.toSatisfy(isForeignKeyViolation);
  });

  it('leaves its site when siteId is set to null', async () => {
    const { repos } = workspaces.a;
    const site = await createSite(repos);
    const host = await createHost(repos, { siteId: site.id });

    expect(await hosts().update(host.id, { siteId: null })).toMatchObject({ siteId: null });
  });

  describe('addresses', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-12T10:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns the host\'s addresses with get and list, normalized and in order', async () => {
      const { repos } = workspaces.a;
      const lan = await createNetwork(repos, { cidr: '10.0.10.0/24' });
      const host = await createHost(repos, {
        addresses: [{ address: '10.0.10.20', networkId: lan.id }, { address: '2001:DB8::20' }],
      });
      const other = await createHost(repos, { addresses: [{ address: '10.0.10.21', networkId: lan.id }] });

      const expected = [{ address: '10.0.10.20', networkId: lan.id }, { address: '2001:db8::20', networkId: null }];
      expect(host.addresses).toEqual(expected);
      expect((await hosts().get(host.id))?.addresses).toEqual(expected);
      expect((await hosts().list()).map(({ addresses }) => addresses))
        .toEqual([expected, [{ address: '10.0.10.21', networkId: lan.id }]]);
      expect(other.addresses).toHaveLength(1);
    });

    it('given addresses in a patch, replaces the set', async () => {
      const { repos } = workspaces.a;
      const host = await createHost(repos, { addresses: [{ address: '10.0.10.20' }, { address: '10.0.10.21' }] });

      const updated = await hosts().update(host.id, { addresses: [{ address: '10.0.10.22' }] });

      expect(updated?.addresses).toEqual([{ address: '10.0.10.22', networkId: null }]);
      expect((await hosts().get(host.id))?.addresses).toEqual([{ address: '10.0.10.22', networkId: null }]);
      expect(await countRows(workspaces.db, 'hostAddress', workspaces.a.workspace.id)).toBe(1);
    });

    it('given a patch without addresses, keeps them, and a patch with only addresses bumps updatedAt', async () => {
      const host = await createHost(workspaces.a.repos, { addresses: [{ address: '10.0.10.20' }] });

      expect((await hosts().update(host.id, { name: 'Renamed' }))?.addresses).toEqual(host.addresses);
      vi.setSystemTime(new Date('2026-10-12T11:00:00.000Z'));
      expect(await hosts().update(host.id, { addresses: [] }))
        .toMatchObject({ addresses: [], updatedAt: new Date('2026-10-12T11:00:00.000Z') });
    });

    it('given an address outside its network\'s CIDR, fails on that address with the CIDR in the message', async () => {
      const { repos } = workspaces.a;
      const lan = await createNetwork(repos, { cidr: '10.0.10.0/24' });
      const host = await createHost(repos);

      const outside = { addresses: [{ address: '10.0.10.20', networkId: lan.id }, { address: '10.0.20.5', networkId: lan.id }] };
      await expect(hosts().create(buildHost(outside))).rejects.toMatchObject({
        constructor: EntityValidationError,
        issues: [{ path: 'addresses.1.address', message: expect.stringContaining('10.0.10.0/24') as unknown }],
      });
      await expect(hosts().update(host.id, outside)).rejects.toBeInstanceOf(EntityValidationError);
      expect(await hosts().get(host.id)).toEqual(host);
    });

    it('given a network of another workspace or an unknown one, fails with a reference error on the address\'s networkId', async () => {
      const { a, b, db } = workspaces;
      const theirNetwork = await createNetwork(b.repos, { cidr: null });

      for (const networkId of [theirNetwork.id, newId()]) {
        await expect(hosts().create(buildHost({ addresses: [{ address: '10.0.10.20' }, { address: '10.0.10.21', networkId }] })))
          .rejects.toMatchObject({ constructor: WorkspaceReferenceError, field: 'addresses.1.networkId', id: networkId });
      }
      expect(await countRows(db, 'host', a.workspace.id)).toBe(0);
      expect(await countRows(db, 'hostAddress', a.workspace.id)).toBe(0);
    });

    it('given a direct address write pairing the workspace with another workspace\'s host or network, the database refuses it', async () => {
      const { a, b, db } = workspaces;
      const theirHost = await createHost(b.repos);
      const theirNetwork = await createNetwork(b.repos);
      await createHost(a.repos, { addresses: [{ address: '10.0.10.20' }] });

      await expect(db.updateTable('hostAddress').set({ hostId: theirHost.id }).where('workspaceId', '=', a.workspace.id).execute())
        .rejects.toSatisfy(isForeignKeyViolation);
      await expect(db.updateTable('hostAddress').set({ networkId: theirNetwork.id }).where('workspaceId', '=', a.workspace.id).execute())
        .rejects.toSatisfy(isForeignKeyViolation);
    });
  });

  it('removes a host with its addresses', async () => {
    const host = await createHost(workspaces.a.repos, { addresses: [{ address: '10.0.10.20' }] });

    expect(await hosts().remove(host.id)).toBe(true);
    expect(await countRows(workspaces.db, 'hostAddress', workspaces.a.workspace.id)).toBe(0);
  });

  it('given a host that services run on, refuses to remove it, naming the dependents and their counts', async () => {
    const { repos } = workspaces.a;
    const host = await createHost(repos);
    await createService(repos, { hostId: host.id });

    await expect(hosts().remove(host.id)).rejects.toMatchObject({
      constructor: EntityInUseError,
      dependents: [{ entity: 'service', count: 1 }],
    });
    expect(await hosts().get(host.id)).toEqual(host);
  });
});
