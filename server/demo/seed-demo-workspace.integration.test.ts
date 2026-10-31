import { describe, expect, it, vi } from 'vitest';

import { DEMO_STACK } from './demo-stack';
import { DEMO_WORKSPACE, seedDemoWorkspace } from './seed-demo-workspace';
import { createAccount, membersOf } from '../../tests/support/accounts';
import { DIALECTS } from '../../tests/support/databases';
import { BUILTIN_REGISTRY, countRows, createWorkspace, useTestWorkspaces } from '../../tests/support/workspaces';
import { listDerivedFlows } from '../repositories/derived-flows';

import type { SeedDemoOptions } from './seed-demo-workspace';
import type { Dialect } from '../../tests/support/databases';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

// A cleanup that cannot run either, as when the database connection dropped: the seed must not rely on one.
const cleanup = vi.hoisted(() => ({ fails: false }));

vi.mock('../repositories/workspaces', async (importOriginal) => {
  const original = await importOriginal<typeof import('../repositories/workspaces')>();
  return {
    ...original,
    deleteWorkspace: (...args: Parameters<typeof original.deleteWorkspace>) => (cleanup.fails
      ? Promise.reject(new Error('Connection lost'))
      : original.deleteWorkspace(...args)),
  };
});

describe.each(DIALECTS)('demo workspace seed on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);

  const logger = () => ({ info: vi.fn(), error: vi.fn() });
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const seed = (options: Partial<SeedDemoOptions> = {}) =>
    seedDemoWorkspace(db(), { env: { STACKMAP_DEMO: 'true' }, registry: BUILTIN_REGISTRY, logger: logger(), ...options });
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

  it('given STACKMAP_DEMO unset or empty, creates no workspace: the demo is offered at setup instead (8)', async () => {
    await seed({ env: {} });
    await seed({ env: { STACKMAP_DEMO: ' ' } });

    expect(await demoWorkspaces()).toEqual([]);
  });

  it.each(['TRUE', '1', 'Yes', 'on'])('given STACKMAP_DEMO=%s, seeds the demo workspace (8)', async (value) => {
    await seed({ env: { STACKMAP_DEMO: value } });

    expect(await demoWorkspaces()).toHaveLength(1);
  });

  it('given STACKMAP_DEMO=false, 0, no or off in any case, creates no workspace', async () => {
    for (const value of ['false', 'FALSE', '0', 'no', 'Off']) {
      await seed({ env: { STACKMAP_DEMO: value } });

      expect(await demoWorkspaces(), value).toEqual([]);
    }
  });

  it('creates the workspace and its data in one transaction: a failed seed leaves nothing, with no cleanup to run', async () => {
    cleanup.fails = true;
    const log = logger();

    try {
      await seed({
        logger: log,
        seed: async (repos) => {
          await repos.sites.create({ name: 'Half done' });
          throw new Error('Seed broke');
        },
      });
    } finally {
      cleanup.fails = false;
    }

    expect(await demoWorkspaces()).toEqual([]);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Seed broke'));
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

describe.each(DIALECTS)('demo ownership on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;

  it('given accounts and STACKMAP_DEMO=true, every instance administrator owns the seeded demo (6)', async () => {
    const ada = await createAccount(db(), { name: 'Ada', email: 'ada@homelab.example', admin: true });
    const alan = await createAccount(db(), { name: 'Alan', email: 'alan@homelab.example', admin: true });
    await createAccount(db(), { name: 'Grace', email: 'grace@homelab.example' });

    await seedDemoWorkspace(db(), {
      env: { STACKMAP_DEMO: 'true' }, registry: BUILTIN_REGISTRY, logger: { info: vi.fn(), error: vi.fn() },
    });

    const demo = await db().selectFrom('workspace').select('id').where('slug', '=', 'demo').executeTakeFirstOrThrow();
    expect(await membersOf(db(), demo.id)).toEqual({ [ada.user.id]: 'owner', [alan.user.id]: 'owner' });
  });
});
