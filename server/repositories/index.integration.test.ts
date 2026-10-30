import { defineExtensionServer } from '@stackmap/extension-sdk';
import { defineEntityRepository } from '@stackmap/extension-sdk/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EntityChangedError } from './errors';
import { createWorkspaceRepositories } from './index';
import { siteRepository } from '../../extensions/core/server/repositories/sites';
import { buildHost, buildNetwork, buildSite } from '../../extensions/core/testing';
import { DIALECTS } from '../../tests/support/databases';
import { BUILTIN_KINDS, BUILTIN_REGISTRY, countRows, useTestWorkspaces } from '../../tests/support/workspaces';
import { BUILTIN_EXTENSION_SERVERS, BUILTIN_EXTENSIONS } from '../extensions/builtin';
import { createExtensionRegistry } from '../extensions/registry';

import type { Dialect } from '../../tests/support/databases';
import type { ExtensionManifest } from '@stackmap/extension-sdk';
import type { RepositoryScope } from '@stackmap/extension-sdk/server';

/** An extension with one entity whose dependency is not installed: it fails, and contributes nothing. */
const orphan: ExtensionManifest = {
  id: 'orphan',
  version: '1.0.0',
  apiVersion: 1,
  name: 'extensions.orphan.name',
  description: 'extensions.orphan.description',
  alwaysOn: false,
  dependsOn: ['missing'],
  code: { server: true },
  contributes: { kinds: {}, entities: [{ id: 'thing', table: 'orphan_thing', label: 'extensions.orphan.entities.thing' }] },
};
const orphanServer = defineExtensionServer(orphan, {
  repositories: [defineEntityRepository({
    entity: 'thing',
    key: 'orphanThings',
    table: 'orphan_thing',
    schema: { input: {}, patch: {} } as never,
    columns: [],
  })],
});

describe.each(DIALECTS)('workspace repositories on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);

  it('returns one repository per entity of the active extensions, under its key, plus transaction', async () => {
    const scope: RepositoryScope = { workspaceId: workspaces.a.workspace.id, actorId: null, kinds: BUILTIN_KINDS };

    const repos = createWorkspaceRepositories(BUILTIN_REGISTRY.repositories())(workspaces.db, scope);

    expect(Object.keys(repos).sort())
      .toEqual(['dnsRecords', 'domains', 'hosts', 'listeners', 'networks', 'proxyRoutes', 'services', 'sites', 'transaction']);
    expect(await repos.sites.create(buildSite())).toMatchObject({ workspaceId: scope.workspaceId, createdBy: null });
  });

  it('gives definition callbacks a frozen scope whose kinds only answer hasKind', async () => {
    const { a, db } = workspaces;
    const scopes: RepositoryScope[] = [];
    const [sites = siteRepository] = BUILTIN_REGISTRY.repositories();
    const spying = { ...sites, check: (context: { scope: RepositoryScope }) => {
      scopes.push(context.scope);
      return Promise.resolve([]);
    } };

    const repos = createWorkspaceRepositories([spying] as never)(db, {
      workspaceId: a.workspace.id, actorId: null, kinds: BUILTIN_REGISTRY,
    });
    await repos.sites.create(buildSite());

    expect(scopes).toHaveLength(1);
    expect(Object.isFrozen(scopes[0])).toBe(true);
    expect(Object.isFrozen(scopes[0]?.kinds)).toBe(true);
    expect(Object.keys(scopes[0]?.kinds ?? {})).toEqual(['hasKind']);
  });

  it('refuses a reference to a table outside the extension\'s and its dependencies\'', async () => {
    const { a, db } = workspaces;
    const [sites = siteRepository] = BUILTIN_REGISTRY.repositories();
    const stray = { ...sites, references: () => [{ field: 'name', table: 'workspace', id: a.workspace.id }] };

    const repos = createWorkspaceRepositories([stray] as never)(db, {
      workspaceId: a.workspace.id, actorId: null, kinds: BUILTIN_KINDS,
    });
    await expect(repos.sites.create(buildSite())).rejects.toThrow('refers to table "workspace"');
  });

  it('leaves out the repositories of a failed extension', () => {
    const registry = createExtensionRegistry([...BUILTIN_EXTENSIONS, orphan], {
      servers: [...BUILTIN_EXTENSION_SERVERS, orphanServer],
    });

    expect(registry.get('orphan')?.state).toBe('failed');
    expect(registry.repositories().map(({ key }) => key)).not.toContain('orphanThings');
    expect(registry.repositories().map(({ key }) => key)).toContain('hosts');
  });

  it('keeps the workspace it was created for when the scope object changes afterwards', async () => {
    const { a, b, db } = workspaces;
    const scope: RepositoryScope = { workspaceId: a.workspace.id, actorId: 'actor-a', kinds: BUILTIN_KINDS };
    const repos = createWorkspaceRepositories(BUILTIN_REGISTRY.repositories())(db, scope);

    scope.workspaceId = b.workspace.id;

    expect(await repos.sites.create(buildSite())).toMatchObject({ workspaceId: a.workspace.id });
    expect(await repos.transaction((tx) => tx.sites.list())).toHaveLength(1);
    expect(await b.repos.sites.list()).toEqual([]);
  });

  it('given a transaction that throws, keeps nothing it wrote', async () => {
    const { a, db } = workspaces;

    await expect(a.repos.transaction(async (tx) => {
      const site = await tx.sites.create(buildSite());
      await tx.hosts.create(buildHost({ siteId: site.id }));
      throw new Error('boom');
    })).rejects.toThrow('boom');

    expect(await countRows(db, 'core_site', a.workspace.id)).toBe(0);
    expect(await countRows(db, 'core_host', a.workspace.id)).toBe(0);
  });

  it('given a transaction that succeeds, keeps everything it wrote, in the same workspace, host addresses included', async () => {
    const { a } = workspaces;

    const host = await a.repos.transaction(async (tx) => {
      const site = await tx.sites.create(buildSite());
      const lan = await tx.networks.create(buildNetwork({ siteId: site.id, cidr: '10.0.10.0/24' }));
      const created = await tx.hosts.create(buildHost({ siteId: site.id, addresses: [{ address: '10.0.10.20' }] }));
      // Replacing addresses uses a transaction of its own, which must join this one.
      return tx.hosts.update(created.id, { addresses: [{ address: '10.0.10.21', networkId: lan.id }] });
    });

    expect(await a.repos.hosts.get(host?.id ?? '')).toMatchObject({
      workspaceId: a.workspace.id,
      addresses: [{ address: '10.0.10.21' }],
    });
    expect(await a.repos.sites.list()).toHaveLength(1);
  });

  it('refuses a reference to a table of another extension whose id extends its own (vpn_x_peer for vpn), before any query', async () => {
    const { a, db } = workspaces;
    const [sites = siteRepository] = BUILTIN_REGISTRY.repositories();
    // core_x_thing starts with core_, as vpn_x_peer starts with vpn_; it would belong to an extension core-x.
    const stray = { ...sites, references: () => [{ field: 'name', table: 'core_x_thing', id: a.workspace.id }] };

    const repos = createWorkspaceRepositories([stray] as never)(db, {
      workspaceId: a.workspace.id, actorId: null, kinds: BUILTIN_KINDS,
    });
    await expect(repos.sites.create(buildSite())).rejects.toThrow('refers to table "core_x_thing"');
  });

  /** The hosts repository, with another writer setting `os` after the update read the host and before it writes. */
  const withConcurrentWriter = (hostId: () => string) => {
    const { a, db } = workspaces;
    const hosts = BUILTIN_REGISTRY.repositories().find(({ key }) => key === 'hosts');
    const racing = { ...hosts, check: async (context: { db: typeof db }, ...rest: unknown[]) => {
      await context.db.updateTable('core_host').set({ os: 'Debian 13' }).where('id', '=', hostId()).execute();
      return (hosts?.check as (...args: unknown[]) => Promise<unknown[]>)(context, ...rest);
    } };
    return createWorkspaceRepositories([racing] as never)(db, {
      workspaceId: a.workspace.id, actorId: null, kinds: BUILTIN_KINDS,
    });
  };

  it('given another writer changing a field between the update\'s read and its write, keeps both changes', async () => {
    const host = await workspaces.a.repos.hosts.create(buildHost({ name: 'Server', os: null }));

    await withConcurrentWriter(() => host.id).hosts.update(host.id, { name: 'Home server' });

    expect(await workspaces.a.repos.hosts.get(host.id)).toMatchObject({ name: 'Home server', os: 'Debian 13' });
  });

  it('given a patch that changes nothing, writes only updatedBy and updatedAt', async () => {
    const host = await workspaces.a.repos.hosts.create(buildHost({ name: 'Server', os: null }));

    await withConcurrentWriter(() => host.id).hosts.update(host.id, { name: 'Server' });

    expect(await workspaces.a.repos.hosts.get(host.id)).toMatchObject({ name: 'Server', os: 'Debian 13', updatedBy: null });
  });

  it('given another update committed between this update\'s read and its write, refuses it and keeps nothing of it', async () => {
    const { a, db } = workspaces;
    const lan = await a.repos.networks.create(buildNetwork({ cidr: '10.0.10.0/24' }));
    const host = await a.repos.hosts.create(buildHost({ name: 'Server', addresses: [{ address: '10.0.10.20', networkId: lan.id }] }));
    const hosts = BUILTIN_REGISTRY.repositories().find(({ key }) => key === 'hosts');
    // Another update commits first: it moves updatedAt, as every update through a repository does.
    const racing = { ...hosts, check: async (context: { db: typeof db }) => {
      await context.db.updateTable('core_host').set({ updatedAt: '2099-01-01T00:00:00.000Z' })
        .where('id', '=', host.id).execute();
      return [];
    } };
    const repos = createWorkspaceRepositories([racing] as never)(db, {
      workspaceId: a.workspace.id, actorId: null, kinds: BUILTIN_KINDS,
    });

    await expect(repos.hosts.update(host.id, { name: 'Home server', addresses: [{ address: '10.0.10.21', networkId: lan.id }] }))
      .rejects.toBeInstanceOf(EntityChangedError);
    expect(await a.repos.hosts.get(host.id)).toMatchObject({ name: 'Server', addresses: [{ address: '10.0.10.20' }] });
  });

  describe('within one millisecond', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('gives every update an updatedAt later than the last one', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-24T10:00:00.000Z'));
      const { repos } = workspaces.a;
      const site = await repos.sites.create(buildSite({ name: 'One' }));

      const first = await repos.sites.update(site.id, { name: 'Two' });
      const second = await repos.sites.update(site.id, { name: 'Three' });

      expect([site, first, second].map((saved) => saved?.updatedAt.toISOString())).toEqual([
        '2026-10-24T10:00:00.000Z', '2026-10-24T10:00:00.001Z', '2026-10-24T10:00:00.002Z',
      ]);
    });
  });
});
