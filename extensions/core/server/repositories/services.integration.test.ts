import { describe, expect, it } from 'vitest';

import { isForeignKeyViolation } from '../../../../server/database/errors';
import { newId } from '../../../../server/database/ids';
import { EntityValidationError, WorkspaceReferenceError } from '../../../../server/repositories/errors';
import { DIALECTS } from '../../../../tests/support/databases';
import { describeScopedRepository } from '../../../../tests/support/scoped-repository-suite';
import { BUILTIN_KINDS, countRows, useTestWorkspaces } from '../../../../tests/support/workspaces';
import { buildService, createHost, createListener, createService } from '../../testing';

import type { ServiceRepository } from './services';
import type { Dialect } from '../../../../tests/support/databases';
import type { KindCatalog } from '@stackmap/extension-sdk/server';

const WITH_TOASTER: KindCatalog = { hasKind: (entity, id) => id === 'toaster' || BUILTIN_KINDS.hasKind(entity, id) };

describe.each(DIALECTS)('services on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const services = (): ServiceRepository => workspaces.a.repos.services;

  describeScopedRepository({
    workspaces,
    repository: 'services',
    table: 'core_service',
    input: () => Promise.resolve(buildService()),
    patch: { name: 'Website database', kind: 'database', image: 'postgres:17', containerName: 'website-db' },
    invalid: { input: { name: 'n'.repeat(101), image: 'i'.repeat(301) }, paths: ['name', 'image'] },
  });

  it('lists the services of a host', async () => {
    const { repos } = workspaces.a;
    const host = await createHost(repos);
    const onHost = await createService(repos, { hostId: host.id });
    await createService(repos);

    expect((await services().list({ hostId: host.id })).map(({ id }) => id)).toEqual([onHost.id]);
  });

  it('given a kind no active extension provides, fails with a validation error on kind', async () => {
    const service = await createService(workspaces.a.repos);

    await expect(services().create(buildService({ kind: 'toaster' }))).rejects.toMatchObject({
      constructor: EntityValidationError,
      issues: [{ path: 'kind', message: expect.stringContaining('toaster') as unknown }],
    });
    await expect(services().update(service.id, { kind: 'toaster' })).rejects.toBeInstanceOf(EntityValidationError);
  });

  it('given a stored kind of an extension that is no longer active, reads and updates the service', async () => {
    const { a } = workspaces;
    const service = await workspaces.repositories(a.workspace.id, { kinds: WITH_TOASTER }).services
      .create(buildService({ kind: 'toaster' }));

    expect(await services().get(service.id)).toMatchObject({ kind: 'toaster' });
    expect(await services().update(service.id, { name: 'Renamed' })).toMatchObject({ name: 'Renamed', kind: 'toaster' });
  });

  it('given a host of another workspace or an unknown one, fails with a reference error on hostId and writes nothing', async () => {
    const { a, b, db } = workspaces;
    const theirHost = await createHost(b.repos);
    const service = await createService(a.repos);

    for (const hostId of [theirHost.id, newId()]) {
      await expect(services().create(buildService({ hostId }))).rejects.toMatchObject({
        constructor: WorkspaceReferenceError,
        field: 'hostId',
        id: hostId,
      });
      await expect(services().update(service.id, { hostId })).rejects.toBeInstanceOf(WorkspaceReferenceError);
    }
    expect(await countRows(db, 'core_service', a.workspace.id)).toBe(1);
    expect(await services().get(service.id)).toEqual(service);
  });

  it('given a direct write that pairs the workspace with another workspace\'s host, the database refuses it', async () => {
    const { a, b, db } = workspaces;
    const theirHost = await createHost(b.repos);
    const service = await createService(a.repos);

    await expect(db.updateTable('core_service').set({ hostId: theirHost.id }).where('id', '=', service.id).execute())
      .rejects.toSatisfy(isForeignKeyViolation);
  });

  it('removes a service with its listeners', async () => {
    const { repos } = workspaces.a;
    const service = await createService(repos);
    await createListener(repos, { serviceId: service.id });
    await createListener(repos, { serviceId: service.id });

    expect(await services().remove(service.id)).toBe(true);
    expect(await countRows(workspaces.db, 'core_listener', workspaces.a.workspace.id)).toBe(0);
  });
});
