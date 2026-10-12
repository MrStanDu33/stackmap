import { describe, expect, it } from 'vitest';

import { EntityConflictError } from './errors';
import { buildDomain, createDnsRecord, createDomain } from '../../tests/factories';
import { DIALECTS } from '../../tests/support/databases';
import { describeScopedRepository } from '../../tests/support/scoped-repository-suite';
import { countRows, useTestWorkspaces } from '../../tests/support/workspaces';

import type { DomainRepository } from './domains';
import type { Dialect } from '../../tests/support/databases';

describe.each(DIALECTS)('domains on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const domains = (): DomainRepository => workspaces.a.repos.domains;

  describeScopedRepository({
    workspaces,
    repository: 'domains',
    table: 'domain',
    input: () => Promise.resolve(buildDomain()),
    patch: { name: 'renamed.example' },
    invalid: { input: { name: 'localhost', status: 'retired' }, paths: ['name', 'status'] },
  });

  it('given a name another domain of the workspace has, in any case or with a trailing dot, fails with a conflict error on name', async () => {
    await createDomain(workspaces.a.repos, { name: 'homelab.example' });

    await expect(domains().create(buildDomain({ name: 'HomeLab.Example.' }))).rejects.toMatchObject({
      constructor: EntityConflictError,
      fields: ['name'],
    });
    expect(await countRows(workspaces.db, 'domain', workspaces.a.workspace.id)).toBe(1);
  });

  it('given a rename to a name another domain of the workspace has, fails with a conflict error on name', async () => {
    await createDomain(workspaces.a.repos, { name: 'homelab.example' });
    const other = await createDomain(workspaces.a.repos, { name: 'other.example' });

    await expect(domains().update(other.id, { name: 'homelab.example' })).rejects.toMatchObject({
      constructor: EntityConflictError,
      fields: ['name'],
    });
    expect(await domains().get(other.id)).toEqual(other);
  });

  it('accepts the same name in another workspace', async () => {
    await createDomain(workspaces.b.repos, { name: 'homelab.example' });

    await expect(domains().create(buildDomain({ name: 'homelab.example' }))).resolves.toMatchObject({ name: 'homelab.example' });
  });

  it('given two concurrent creates of the same name, exactly one succeeds and the other gets the conflict error', async () => {
    const results = await Promise.allSettled([
      domains().create(buildDomain({ name: 'homelab.example' })),
      domains().create(buildDomain({ name: 'homelab.example' })),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({ reason: { constructor: EntityConflictError } });
  });

  it('removes a domain with its DNS records', async () => {
    const domain = await createDomain(workspaces.a.repos);
    await createDnsRecord(workspaces.a.repos, { domainId: domain.id });
    await createDnsRecord(workspaces.a.repos, { domainId: domain.id });

    expect(await domains().remove(domain.id)).toBe(true);
    expect(await countRows(workspaces.db, 'dnsRecord', workspaces.a.workspace.id)).toBe(0);
  });
});
