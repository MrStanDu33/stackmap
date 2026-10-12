import { defineExtensionServer } from '@stackmap/extension-sdk';
import { defineEntityRepository } from '@stackmap/extension-sdk/server';
import { describe, expect, it } from 'vitest';

import { createWorkspaceRepositories } from './index';
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
      .toEqual(['dnsRecords', 'domains', 'hosts', 'listeners', 'networks', 'services', 'sites', 'transaction']);
    expect(await repos.sites.create(buildSite())).toMatchObject({ workspaceId: scope.workspaceId, createdBy: null });
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
});
