import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { EntityConflictError, EntityValidationError, WorkspaceReferenceError } from '../../../../server/repositories/errors';
import { DIALECTS } from '../../../../tests/support/databases';
import { describeScopedRepository } from '../../../../tests/support/scoped-repository-suite';
import { countRows, useTestWorkspaces } from '../../../../tests/support/workspaces';
import { createHost } from '../../../core/testing';

import type { PortForwardRepository } from './port-forwards';
import type { WorkspaceRepositories } from '../../../../server/repositories';
import type { Dialect } from '../../../../tests/support/databases';
import type { PortForwardInput } from '../../entities';

const createRouter = (repos: WorkspaceRepositories, addresses = ['203.0.113.10', '10.0.10.1']) =>
  createHost(repos, { name: 'Edge router', kind: 'router', addresses: addresses.map((address) => ({ address })) });

const forwardOn = (hostId: string, overrides: Partial<PortForwardInput> = {}): PortForwardInput => ({
  hostId,
  externalAddress: '203.0.113.10',
  externalPort: 443,
  transport: 'tcp',
  internalAddress: '10.0.10.20',
  internalPort: 443,
  ...overrides,
});

describe.each(DIALECTS)('port forwards on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const forwards = (): PortForwardRepository => workspaces.a.repos.portForwards;

  describeScopedRepository({
    workspaces,
    repository: 'portForwards',
    table: 'nat_portForward',
    input: async (repos: WorkspaceRepositories) => forwardOn((await createRouter(repos)).id, {
      externalPort: 1024 + Math.floor(Math.random() * 60_000),
    }),
    patch: { internalPort: 8443, description: 'Website' },
    invalid: { input: { externalPort: 0, transport: 'sctp' }, paths: ['externalPort', 'transport'] },
  });

  it('given a host with an address, stores a forward of one of its ports with its fields and the common ones, returned by get and list (shared suite)', async () => {
    const router = await createRouter(workspaces.a.repos);

    const forward = await forwards().create(forwardOn(router.id, { description: 'Website over HTTPS' }));

    expect(forward).toMatchObject({ ...forwardOn(router.id), description: 'Website over HTTPS', status: 'active' });
    expect(await forwards().get(forward.id)).toEqual(forward);
    expect(await forwards().list()).toEqual([forward]);
  });

  it('refuses an external address the host does not hold, on create or move, with an issue on externalAddress naming the address', async () => {
    const router = await createRouter(workspaces.a.repos);
    const other = await createHost(workspaces.a.repos, { addresses: [{ address: '198.51.100.7' }] });
    const forward = await forwards().create(forwardOn(router.id));
    const refused = (address: string) => ({
      constructor: EntityValidationError,
      issues: [{ path: 'externalAddress', message: expect.stringContaining(address) as unknown }],
    });

    await expect(forwards().create(forwardOn(router.id, { externalAddress: '198.51.100.7' })))
      .rejects.toMatchObject(refused('198.51.100.7'));
    await expect(forwards().update(forward.id, { hostId: other.id })).rejects.toMatchObject(refused('203.0.113.10'));
    expect(await forwards().get(forward.id)).toEqual(forward);
  });

  it('refuses a second forward of the same port, transport and address of a host as a conflict on externalPort', async () => {
    const router = await createRouter(workspaces.a.repos);
    await forwards().create(forwardOn(router.id));

    await expect(forwards().create(forwardOn(router.id, { internalAddress: '10.0.10.21' })))
      .rejects.toMatchObject({ constructor: EntityConflictError, fields: ['externalPort'] });
    expect(await countRows(workspaces.db, 'nat_portForward', workspaces.a.workspace.id)).toBe(1);
  });

  it('accepts the same port with the other transport, on another address or on another host', async () => {
    const router = await createRouter(workspaces.a.repos);
    const firewall = await createRouter(workspaces.a.repos, ['203.0.113.10']);
    await forwards().create(forwardOn(router.id));

    await forwards().create(forwardOn(router.id, { transport: 'udp' }));
    await forwards().create(forwardOn(router.id, { externalAddress: '10.0.10.1' }));
    await forwards().create(forwardOn(firewall.id));

    expect(await forwards().list()).toHaveLength(4);
  });

  it('refuses a host of another workspace as an unknown reference', async () => {
    const theirs = await createRouter(workspaces.b.repos);
    const mine = await forwards().create(forwardOn((await createRouter(workspaces.a.repos)).id));
    const refused = { constructor: WorkspaceReferenceError, field: 'hostId', id: theirs.id };

    await expect(forwards().create(forwardOn(theirs.id))).rejects.toMatchObject(refused);
    await expect(forwards().update(mine.id, { hostId: theirs.id })).rejects.toMatchObject(refused);
    await expect(forwards().create(forwardOn(randomUUID())))
      .rejects.toMatchObject({ constructor: WorkspaceReferenceError });
  });

  it('removes a host\'s forwards with the host', async () => {
    const { repos } = workspaces.a;
    const router = await createRouter(repos);
    const kept = await forwards().create(forwardOn((await createRouter(repos, ['203.0.113.10'])).id));
    await forwards().create(forwardOn(router.id));

    expect(await repos.hosts.remove(router.id)).toBe(true);

    expect(await forwards().list()).toEqual([kept]);
  });
});
