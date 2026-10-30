import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { EntityInUseError, EntityValidationError, WorkspaceReferenceError } from '../../../../server/repositories/errors';
import { DIALECTS } from '../../../../tests/support/databases';
import { describeScopedRepository } from '../../../../tests/support/scoped-repository-suite';
import { countRows, useTestWorkspaces } from '../../../../tests/support/workspaces';
import { createListener, createService } from '../../testing';

import type { FlowRepository } from './flows';
import type { WorkspaceRepositories } from '../../../../server/repositories';
import type { Dialect } from '../../../../tests/support/databases';
import type { FlowInput } from '../../entities';

/** A website calling its database: a source service and a listener of another service. */
async function websiteAndDatabase(repos: WorkspaceRepositories) {
  const website = await createService(repos, { name: 'Website' });
  const database = await createListener(repos, { port: 5432 });
  return { website, database };
}

describe.each(DIALECTS)('manual flows on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const flows = (): FlowRepository => workspaces.a.repos.flows;
  const input = async (repos: WorkspaceRepositories, overrides: Partial<FlowInput> = {}): Promise<FlowInput> => {
    const { website, database } = await websiteAndDatabase(repos);
    return { sourceServiceId: website.id, targetListenerId: database.id, ...overrides };
  };

  describeScopedRepository({
    workspaces,
    repository: 'flows',
    table: 'core_flow',
    input,
    patch: { purpose: 'Reads the forecasts', encrypted: true },
    invalid: { input: { purpose: 'x'.repeat(201), encrypted: 'yes' }, paths: ['purpose', 'encrypted'] },
  });

  it('given a service and a listener of the workspace, stores a flow between them with its fields and the common ones, returned by get and list', async () => {
    const { repos } = workspaces.a;

    const flow = await flows().create(await input(repos, { purpose: 'Stores the site content', protocol: 'tcp' }));

    expect(flow).toMatchObject({ purpose: 'Stores the site content', protocol: 'tcp', encrypted: null, status: 'active' });
    expect(await flows().get(flow.id)).toEqual(flow);
    expect(await flows().list()).toEqual([flow]);
  });

  it('refuses an unknown source service, an unknown target listener or an inactive protocol kind, naming the field', async () => {
    const { repos } = workspaces.a;
    const valid = await input(repos);

    await expect(flows().create({ ...valid, sourceServiceId: randomUUID() }))
      .rejects.toMatchObject({ constructor: WorkspaceReferenceError, field: 'sourceServiceId' });
    await expect(flows().create({ ...valid, targetListenerId: randomUUID() }))
      .rejects.toMatchObject({ constructor: WorkspaceReferenceError, field: 'targetListenerId' });
    await expect(flows().create({ ...valid, protocol: 'carrier-pigeon' }))
      .rejects.toMatchObject({ constructor: EntityValidationError, issues: [{ path: 'protocol' }] });
    expect(await countRows(workspaces.db, 'core_flow', workspaces.a.workspace.id)).toBe(0);
  });

  it('refuses a service or listener of another workspace as an unknown reference (isolation suite)', async () => {
    const mine = await input(workspaces.a.repos);
    const theirs = await input(workspaces.b.repos);

    for (const field of ['sourceServiceId', 'targetListenerId'] as const) {
      await expect(flows().create({ ...mine, [field]: theirs[field] }))
        .rejects.toMatchObject({ constructor: WorkspaceReferenceError, field, id: theirs[field] });
    }
  });

  it('refuses to remove a listener used by a manual flow, naming the flow, and removes nothing', async () => {
    const { repos } = workspaces.a;
    const flow = await flows().create(await input(repos));

    await expect(repos.listeners.remove(flow.targetListenerId))
      .rejects.toMatchObject({ constructor: EntityInUseError, dependents: [{ entity: 'flow', count: 1 }] });
    const target = await repos.listeners.get(flow.targetListenerId);
    await expect(repos.services.remove(target?.serviceId ?? ''))
      .rejects.toMatchObject({ constructor: EntityInUseError, dependents: [{ entity: 'flow', count: 1 }] });

    expect(await repos.listeners.get(flow.targetListenerId)).toBeDefined();
    expect(await flows().get(flow.id)).toEqual(flow);
  });

  it('refuses to remove a service used by a manual flow as its source, naming the flow, and removes nothing', async () => {
    const { repos } = workspaces.a;
    const flow = await flows().create(await input(repos));

    await expect(repos.services.remove(flow.sourceServiceId))
      .rejects.toMatchObject({ constructor: EntityInUseError, dependents: [{ entity: 'flow', count: 1 }] });

    expect(await repos.services.get(flow.sourceServiceId)).toBeDefined();
  });

  it('keeps updates and removals of a manual flow like any entity', async () => {
    const { repos } = workspaces.a;
    const flow = await flows().create(await input(repos));
    const other = await createListener(repos, { port: 6379 });

    expect(await flows().update(flow.id, { targetListenerId: other.id, encrypted: false }))
      .toMatchObject({ targetListenerId: other.id, encrypted: false });
    expect(await flows().remove(flow.id)).toBe(true);
    expect(await flows().list()).toEqual([]);
    expect(await repos.listeners.remove(flow.targetListenerId)).toBe(true);
  });
});
