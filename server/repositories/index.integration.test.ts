import { describe, expect, it } from 'vitest';

import { workspaceRepositories } from './index';
import { buildHost, buildNetwork, buildSite } from '../../tests/factories';
import { DIALECTS } from '../../tests/support/databases';
import { BUILTIN_KINDS, countRows, useTestWorkspaces } from '../../tests/support/workspaces';

import type { RepositoryScope } from './entity-repository';
import type { Dialect } from '../../tests/support/databases';

describe.each(DIALECTS)('workspace repositories on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);

  it('returns one repository per entity, bound to the workspace of the scope', async () => {
    const scope: RepositoryScope = { workspaceId: workspaces.a.workspace.id, actorId: null, kinds: BUILTIN_KINDS };

    const repos = workspaceRepositories(workspaces.db, scope);

    expect(Object.keys(repos).sort())
      .toEqual(['dnsRecords', 'domains', 'hosts', 'listeners', 'networks', 'services', 'sites', 'transaction']);
    expect(await repos.sites.create(buildSite())).toMatchObject({ workspaceId: scope.workspaceId, createdBy: null });
  });

  it('keeps the workspace it was created for when the scope object changes afterwards', async () => {
    const { a, b, db } = workspaces;
    const scope: RepositoryScope = { workspaceId: a.workspace.id, actorId: 'actor-a', kinds: BUILTIN_KINDS };
    const repos = workspaceRepositories(db, scope);

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

    expect(await countRows(db, 'site', a.workspace.id)).toBe(0);
    expect(await countRows(db, 'host', a.workspace.id)).toBe(0);
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
