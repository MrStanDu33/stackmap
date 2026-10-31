import { describe, expect, it, vi } from 'vitest';

import { DEMO_STACK } from './demo-stack';
import { DEMO_WORKSPACE, seedDemoWorkspace } from './seed-demo-workspace';
import { DIALECTS } from '../../tests/support/databases';
import { BUILTIN_REGISTRY, countRows, createWorkspace, useTestWorkspaces } from '../../tests/support/workspaces';
import { listDerivedFlows } from '../repositories/derived-flows';

import type { SeedDemoOptions } from './seed-demo-workspace';
import type { Dialect } from '../../tests/support/databases';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

describe.each(DIALECTS)('demo workspace seed on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);

  const logger = () => ({ info: vi.fn(), error: vi.fn() });
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const seed = (options: Partial<SeedDemoOptions> = {}) =>
    seedDemoWorkspace(db(), { env: {}, registry: BUILTIN_REGISTRY, logger: logger(), ...options });
  const demoWorkspaces = () => db().selectFrom('workspace').select(['id', 'name']).where('slug', '=', 'demo').execute();

  it('given no demo workspace, creates workspace demo with the demo stack and its derived flows', async () => {
    await seed();

    const [demo, ...others] = await demoWorkspaces();
    expect(others).toEqual([]);
    expect(demo?.name).toBe(DEMO_WORKSPACE.name);
    const id = demo?.id ?? '';
    expect(await countRows(workspaces.db, 'core_service', id)).toBe(Object.keys(DEMO_STACK.services).length);
    expect(await countRows(workspaces.db, 'core_flow', id)).toBe(Object.keys(DEMO_STACK.flows).length);
    expect(await countRows(workspaces.db, 'nat_portForward', id)).toBe(Object.keys(DEMO_STACK.portForwards).length);
    expect((await listDerivedFlows(db(), id)).map(({ extension }) => extension).sort())
      .toEqual(expect.arrayContaining(['core', 'nat', 'reverse-proxy']));
  });

  it('given a demo workspace, even an empty one, creates and changes nothing', async () => {
    const existing = await createWorkspace(db(), { name: 'Mine', slug: 'demo' });

    await seed();

    expect(await demoWorkspaces()).toEqual([{ id: existing.id, name: 'Mine' }]);
    expect(await countRows(workspaces.db, 'core_site', existing.id)).toBe(0);
  });

  it('given STACKMAP_DEMO=false, creates no workspace', async () => {
    await seed({ env: { STACKMAP_DEMO: 'false' } });

    expect(await demoWorkspaces()).toEqual([]);
  });

  it('given a seed that fails midway, leaves no demo workspace and logs the error', async () => {
    const log = logger();

    await seed({
      logger: log,
      seed: async (repos) => {
        await repos.sites.create({ name: 'Half done' });
        throw new Error('Seed broke');
      },
    });

    expect(await demoWorkspaces()).toEqual([]);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Seed broke'));
  });

  it('given another process created demo first, does nothing and does not throw', async () => {
    const [first, second] = [logger(), logger()];

    await expect(Promise.all([seed({ logger: first }), seed({ logger: second })])).resolves.toBeDefined();

    const [demo, ...others] = await demoWorkspaces();
    expect(others).toEqual([]);
    expect(await countRows(workspaces.db, 'core_site', demo?.id ?? '')).toBe(Object.keys(DEMO_STACK.sites).length);
    expect(first.error).not.toHaveBeenCalled();
    expect(second.error).not.toHaveBeenCalled();
  });

  it('logs that the demo workspace was seeded, and logs nothing when it skips', async () => {
    const [seeded, skipped] = [logger(), logger()];

    await seed({ logger: seeded });
    await seed({ logger: skipped });

    expect(seeded.info).toHaveBeenCalledExactlyOnceWith('Seeded the demo workspace');
    expect(skipped.info).not.toHaveBeenCalled();
    expect(skipped.error).not.toHaveBeenCalled();
  });
});
