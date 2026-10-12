import { describe, expect, it } from 'vitest';

import {
  createDnsRecord, createDomain, createHost, createListener, createNetwork, createService, createSite, createWorkspace,
} from './index';
import { DIALECTS } from '../support/databases';
import { useTestWorkspaces } from '../support/workspaces';

import type { Dialect } from '../support/databases';

describe.each(DIALECTS)('factories on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);

  it('creates a workspace', async () => {
    expect(await createWorkspace(workspaces.db, { name: 'Demo homelab' }))
      .toMatchObject({ name: 'Demo homelab', slug: expect.stringMatching(/^workspace-\d+$/) as unknown });
  });

  it('creates every entity in the workspace of the repositories', async () => {
    const { repos, workspace } = workspaces.a;

    const created = [
      await createSite(repos), await createNetwork(repos), await createHost(repos), await createService(repos),
      await createListener(repos), await createDomain(repos), await createDnsRecord(repos),
    ];

    expect(created.map(({ workspaceId }) => workspaceId)).toEqual(created.map(() => workspace.id));
  });

  it('creates the required parents: a listener\'s service, a DNS record\'s domain', async () => {
    const { repos } = workspaces.a;

    const listener = await createListener(repos);
    const record = await createDnsRecord(repos);

    expect((await repos.services.list()).map(({ id }) => id)).toEqual([listener.serviceId]);
    expect((await repos.domains.list()).map(({ id }) => id)).toEqual([record.domainId]);
  });

  it('leaves optional parents null unless given', async () => {
    const { repos } = workspaces.a;
    const site = await createSite(repos);

    expect(await createHost(repos)).toMatchObject({ siteId: null });
    expect(await createNetwork(repos)).toMatchObject({ siteId: null });
    expect(await createService(repos)).toMatchObject({ hostId: null });
    expect(await createHost(repos, { siteId: site.id })).toMatchObject({ siteId: site.id });
  });
});
