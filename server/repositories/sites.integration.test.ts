import { describe, expect, it } from 'vitest';

import { EntityInUseError } from './errors';
import { buildSite, createHost, createNetwork, createSite } from '../../tests/factories';
import { DIALECTS } from '../../tests/support/databases';
import { describeScopedRepository } from '../../tests/support/scoped-repository-suite';
import { useTestWorkspaces } from '../../tests/support/workspaces';

import type { SiteRepository } from './sites';
import type { Dialect } from '../../tests/support/databases';

describe.each(DIALECTS)('sites on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const sites = (): SiteRepository => workspaces.a.repos.sites;

  describeScopedRepository({
    workspaces,
    repository: 'sites',
    table: 'site',
    input: () => Promise.resolve(buildSite()),
    patch: { name: 'Second home', status: 'deprecated' },
    invalid: { input: { name: '', status: 'retired' }, paths: ['name', 'status'] },
  });

  it('removes a site nothing references', async () => {
    const site = await createSite(workspaces.a.repos);

    expect(await sites().remove(site.id)).toBe(true);
    expect(await sites().get(site.id)).toBeUndefined();
    expect(await sites().remove(site.id)).toBe(false);
  });

  it('given a site referenced by hosts or networks, refuses to remove it, naming the dependents and their counts', async () => {
    const { repos } = workspaces.a;
    const site = await createSite(repos);
    await createHost(repos, { siteId: site.id });
    await createHost(repos, { siteId: site.id });
    await createNetwork(repos, { siteId: site.id });

    const removing = sites().remove(site.id);

    await expect(removing).rejects.toBeInstanceOf(EntityInUseError);
    await expect(removing).rejects.toMatchObject({
      dependents: expect.arrayContaining([{ entity: 'host', count: 2 }, { entity: 'network', count: 1 }]) as unknown,
    });
    expect(await sites().get(site.id)).toEqual(site);
  });
});
