import { describe, expect, it } from 'vitest';

import { EntityValidationError, WorkspaceReferenceError } from './errors';
import { buildListener, createListener, createService } from '../../tests/factories';
import { DIALECTS } from '../../tests/support/databases';
import { describeScopedRepository } from '../../tests/support/scoped-repository-suite';
import { countRows, useTestWorkspaces } from '../../tests/support/workspaces';
import { isForeignKeyViolation } from '../database/errors';
import { newId } from '../database/ids';

import type { WorkspaceRepositories } from './index';
import type { ListenerRepository } from './listeners';
import type { Dialect } from '../../tests/support/databases';

describe.each(DIALECTS)('listeners on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const listeners = (): ListenerRepository => workspaces.a.repos.listeners;

  describeScopedRepository({
    workspaces,
    repository: 'listeners',
    table: 'listener',
    input: async (repos: WorkspaceRepositories) => buildListener({ serviceId: (await createService(repos)).id }),
    patch: { port: 8443, protocol: 'https', bindAddress: '10.0.10.20', publishedPort: 443 },
    invalid: { input: { port: 0, transport: 'sctp' }, paths: ['port', 'transport'] },
  });

  it('lists the listeners of a service', async () => {
    const { repos } = workspaces.a;
    const service = await createService(repos);
    const http = await createListener(repos, { serviceId: service.id, port: 80 });
    const https = await createListener(repos, { serviceId: service.id, port: 443 });
    await createListener(repos);

    expect((await listeners().list({ serviceId: service.id })).map(({ id }) => id)).toEqual([http.id, https.id]);
  });

  it('given a protocol no active extension provides, fails with a validation error on protocol', async () => {
    const service = await createService(workspaces.a.repos);
    const listener = await createListener(workspaces.a.repos, { serviceId: service.id, protocol: 'https' });

    await expect(listeners().create(buildListener({ serviceId: service.id, protocol: 'gopher' }))).rejects.toMatchObject({
      constructor: EntityValidationError,
      issues: [{ path: 'protocol', message: expect.stringContaining('gopher') as unknown }],
    });
    await expect(listeners().update(listener.id, { protocol: 'gopher' })).rejects.toBeInstanceOf(EntityValidationError);
    expect(await listeners().update(listener.id, { protocol: null })).toMatchObject({ protocol: null });
  });

  it('given a service of another workspace or an unknown one, fails with a reference error on serviceId and writes nothing', async () => {
    const { a, b, db } = workspaces;
    const theirService = await createService(b.repos);
    const listener = await createListener(a.repos);

    for (const serviceId of [theirService.id, newId()]) {
      await expect(listeners().create(buildListener({ serviceId }))).rejects.toMatchObject({
        constructor: WorkspaceReferenceError,
        field: 'serviceId',
        id: serviceId,
      });
      await expect(listeners().update(listener.id, { serviceId })).rejects.toBeInstanceOf(WorkspaceReferenceError);
    }
    expect(await countRows(db, 'listener', a.workspace.id)).toBe(1);
    expect(await listeners().get(listener.id)).toEqual(listener);
  });

  it('moves a listener to another service of the same workspace', async () => {
    const { repos } = workspaces.a;
    const listener = await createListener(repos);
    const other = await createService(repos);

    expect(await listeners().update(listener.id, { serviceId: other.id })).toMatchObject({ serviceId: other.id });
  });

  it('given a direct write that pairs the workspace with another workspace\'s service, the database refuses it', async () => {
    const { a, b, db } = workspaces;
    const theirService = await createService(b.repos);
    const listener = await createListener(a.repos);

    await expect(db.updateTable('listener').set({ serviceId: theirService.id }).where('id', '=', listener.id).execute())
      .rejects.toSatisfy(isForeignKeyViolation);
  });
});
