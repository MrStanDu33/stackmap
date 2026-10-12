import { describe, expect, it } from 'vitest';

import { isForeignKeyViolation } from '../../../../server/database/errors';
import { newId } from '../../../../server/database/ids';
import { WorkspaceReferenceError } from '../../../../server/repositories/errors';
import { DIALECTS } from '../../../../tests/support/databases';
import { describeScopedRepository } from '../../../../tests/support/scoped-repository-suite';
import { countRows, useTestWorkspaces } from '../../../../tests/support/workspaces';
import { buildDnsRecord, createDnsRecord, createDomain } from '../../testing';

import type { DnsRecordRepository } from './dns-records';
import type { WorkspaceRepositories } from '../../../../server/repositories';
import type { Dialect } from '../../../../tests/support/databases';

describe.each(DIALECTS)('DNS records on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const records = (): DnsRecordRepository => workspaces.a.repos.dnsRecords;

  describeScopedRepository({
    workspaces,
    repository: 'dnsRecords',
    table: 'core_dnsRecord',
    input: async (repos: WorkspaceRepositories) => buildDnsRecord({ domainId: (await createDomain(repos)).id }),
    patch: { name: 'www', type: 'CNAME', value: 'homelab.example', view: 'internal', proxied: true },
    invalid: { input: { type: 'PTR', view: 'external' }, paths: ['type', 'view'] },
  });

  it('lists the records of a domain', async () => {
    const { repos } = workspaces.a;
    const domain = await createDomain(repos);
    const apex = await createDnsRecord(repos, { domainId: domain.id, name: '@' });
    const www = await createDnsRecord(repos, { domainId: domain.id, name: 'www', type: 'CNAME', value: domain.name });
    await createDnsRecord(repos);

    expect((await records().list({ domainId: domain.id })).map(({ id }) => id)).toEqual([apex.id, www.id]);
  });

  it('returns wildcard and proxied as booleans', async () => {
    const wildcard = await createDnsRecord(workspaces.a.repos, { name: '*.dev', proxied: true });
    const plain = await createDnsRecord(workspaces.a.repos, { name: 'app' });

    expect(wildcard).toMatchObject({ wildcard: true, proxied: true });
    expect(await records().get(plain.id)).toMatchObject({ wildcard: false, proxied: false });
    expect(await workspaces.db.selectFrom('core_dnsRecord').select('proxied').where('id', '=', wildcard.id).executeTakeFirst())
      .toEqual({ proxied: 1 });
  });

  it('given a domain of another workspace or an unknown one, fails with a reference error on domainId and writes nothing', async () => {
    const { a, b, db } = workspaces;
    const theirDomain = await createDomain(b.repos);
    const record = await createDnsRecord(a.repos);

    for (const domainId of [theirDomain.id, newId()]) {
      await expect(records().create(buildDnsRecord({ domainId }))).rejects.toMatchObject({
        constructor: WorkspaceReferenceError,
        field: 'domainId',
        id: domainId,
      });
      await expect(records().update(record.id, { domainId })).rejects.toBeInstanceOf(WorkspaceReferenceError);
    }
    expect(await countRows(db, 'core_dnsRecord', a.workspace.id)).toBe(1);
    expect(await records().get(record.id)).toEqual(record);
  });

  it('moves a record to another domain of the same workspace', async () => {
    const record = await createDnsRecord(workspaces.a.repos);
    const other = await createDomain(workspaces.a.repos);

    expect(await records().update(record.id, { domainId: other.id })).toMatchObject({ domainId: other.id });
  });

  it('given a direct write that pairs the workspace with another workspace\'s domain, the database refuses it', async () => {
    const { a, b, db } = workspaces;
    const theirDomain = await createDomain(b.repos);
    const record = await createDnsRecord(a.repos);

    await expect(db.updateTable('core_dnsRecord').set({ domainId: theirDomain.id }).where('id', '=', record.id).execute())
      .rejects.toSatisfy(isForeignKeyViolation);
  });
});
