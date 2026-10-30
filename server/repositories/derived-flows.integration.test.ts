import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { listDerivedFlows } from './derived-flows';
import { createWorkspaceRepositories } from './index';
import { createListener, createService } from '../../extensions/core/testing';
import { DIALECTS } from '../../tests/support/databases';
import { ACTOR, BUILTIN_KINDS, BUILTIN_REGISTRY, useTestWorkspaces } from '../../tests/support/workspaces';
import { BUILTIN_EXTENSION_SERVERS, BUILTIN_EXTENSIONS } from '../extensions/builtin';
import { createExtensionRegistry } from '../extensions/registry';

import type { WorkspaceRepositories } from './index';
import type { Dialect } from '../../tests/support/databases';
import type { RegisteredFlowDeriver } from '../extensions/registry';
import type { ExtensionLogger } from '@stackmap/extension-sdk';
import type { FlowDeriver, FlowDraft, FlowReader } from '@stackmap/extension-sdk/server';

/** A deriver giving one flow per listener, from the public client, for the hostnames its tags name. */
const perListener = (id = 'listeners'): FlowDeriver => ({
  id,
  derive: async ({ read }) => (await read.listeners.list()).map((listener): FlowDraft => ({
    key: listener.id,
    source: { client: 'public' },
    targetListenerId: listener.id,
    hostnames: listener.tags.map((tag) => `${tag}.homelab.example`),
    basis: [{ entity: 'listener', id: listener.id }],
  })),
});

describe.each(DIALECTS)('derived flow refresh on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const logs: string[] = [];
  const logger = (extension: string): ExtensionLogger => ({
    info: () => undefined,
    warn: (message) => logs.push(`${extension}: ${message}`),
    error: (message) => logs.push(`${extension}: ${message}`),
  });

  /** Repositories of a workspace that run only the given derivers, each as the extension `probe`. */
  const reposWith = (derivers: FlowDeriver[], workspaceId = workspaces.a.workspace.id): WorkspaceRepositories => {
    logs.length = 0;
    const flowDerivers: RegisteredFlowDeriver[] = derivers.map((deriver) => ({ extension: 'probe', deriver }));
    return createWorkspaceRepositories(BUILTIN_REGISTRY.repositories(), { flowDerivers, logger, deriverTimeoutMs: 50 })(
      workspaces.db, { workspaceId, actorId: ACTOR, kinds: BUILTIN_KINDS },
    );
  };
  const flowsOf = (workspaceId = workspaces.a.workspace.id) => listDerivedFlows(workspaces.db, workspaceId);

  it('gives derivers read access to the workspace entities, with get and list only', async () => {
    // The reader belongs to the refresh's transaction: it is used inside derive, before the commit.
    let seen: { keys: string[]; methods: string[]; listed: unknown; got: unknown } | undefined;
    const spy = async (read: FlowReader) => {
      const listed = await read.listeners.list();
      const got = listed[0] ? await read.listeners.get(listed[0].id) : undefined;
      seen = { keys: Object.keys(read), methods: Object.keys(read.listeners).sort(), listed, got };
      return [];
    };
    const repos = reposWith([{ id: 'spy', derive: ({ read }) => spy(read) }]);

    const listener = await repos.transaction((tx) => createListener(tx));

    expect(seen?.listed).toEqual([listener]);
    expect(seen?.got).toEqual(listener);
    expect(seen?.methods).toEqual(['get', 'list']);
    expect(seen?.keys).not.toContain('transaction');
  });

  it('given a write that makes a deriver return a flow, stores it with its extension, deriver, key, source, target, hostnames and basis', async () => {
    const repos = reposWith([perListener()]);

    const listener = await createListener(repos, { tags: ['app'] });

    expect(await flowsOf()).toEqual([{
      id: expect.any(String) as unknown,
      extension: 'probe',
      deriver: 'listeners',
      key: listener.id,
      sourceServiceId: null,
      sourceClient: 'public',
      targetListenerId: listener.id,
      protocol: null,
      encrypted: null,
      hostnames: ['app.homelab.example'],
      basis: [{ entity: 'listener', id: listener.id }],
    }]);
  });

  it('keeps a derived flow unchanged, with its id, when an unrelated write happens', async () => {
    const repos = reposWith([perListener()]);
    await createListener(repos, { tags: ['app'] });
    const before = await flowsOf();

    await createService(repos);

    expect(await flowsOf()).toEqual(before);
  });

  it('updates the same row, with its id, when a derived flow\'s hostnames change', async () => {
    const repos = reposWith([perListener()]);
    const listener = await createListener(repos, { tags: ['app'] });
    const [before] = await flowsOf();

    await repos.listeners.update(listener.id, { tags: ['app', 'www'] });

    expect(await flowsOf()).toEqual([{ ...before, hostnames: ['app.homelab.example', 'www.homelab.example'] }]);
  });

  it('deletes a derived flow whose key the deriver no longer returns', async () => {
    const repos = reposWith([perListener()]);
    const kept = await createListener(repos);
    const gone = await createListener(repos);

    await repos.listeners.remove(gone.id);

    expect((await flowsOf()).map(({ key }) => key)).toEqual([kept.id]);
  });

  it('runs the derivers once, at the end, for several writes in one transaction', async () => {
    let runs = 0;
    const counted = perListener();
    const repos = reposWith([{
      id: 'counted',
      derive: (context) => {
        runs += 1;
        return counted.derive(context);
      },
    }]);

    await repos.transaction(async (tx) => {
      const service = await createService(tx);
      await createListener(tx, { serviceId: service.id });
      await createListener(tx, { serviceId: service.id });
    });

    expect(runs).toBe(1);
    expect(await flowsOf()).toHaveLength(2);
  });

  it('leaves the derived flows as before when a transaction rolls back after a write', async () => {
    const repos = reposWith([perListener()]);
    await createListener(repos);
    const before = await flowsOf();

    await expect(repos.transaction(async (tx) => {
      await createListener(tx);
      throw new Error('halfway');
    })).rejects.toThrow('halfway');

    expect(await flowsOf()).toEqual(before);
  });

  describe.each([
    ['throws', () => Promise.reject(new Error('boom'))],
    ['times out', () => new Promise<never>(() => undefined)],
    ['returns an invalid result', () => Promise.resolve([{ key: 'broken' }] as never)],
  ])('given a deriver that %s', (_, failure: () => Promise<readonly FlowDraft[]>) => {
    it('keeps the write, refreshes the other derivers, keeps its stored flows and logs the failure with its extension', async () => {
      let failing = false;
      const healthy = perListener('healthy');
      const flaky = perListener('flaky');
      const repos = reposWith([healthy, { id: 'flaky', derive: (context) => (failing ? failure() : flaky.derive(context)) }]);
      const first = await createListener(repos);
      const stored = (await flowsOf()).filter(({ deriver }) => deriver === 'flaky');
      failing = true;

      // One transaction: one refresh, so one failure to log.
      const second = await repos.transaction((tx) => createListener(tx));

      expect(await repos.listeners.get(second.id)).toBeDefined();
      const flows = await flowsOf();
      expect(flows.filter(({ deriver }) => deriver === 'healthy').map(({ key }) => key).sort())
        .toEqual([first.id, second.id].sort());
      expect(flows.filter(({ deriver }) => deriver === 'flaky')).toEqual(stored);
      expect(logs).toEqual([expect.stringMatching(/^probe: .*flaky/) as unknown]);
    });
  });

  it('drops and logs a draft whose source service or target listener is not in the workspace, and stores the others', async () => {
    const elsewhere = await createListener(workspaces.b.repos);
    const unknown = randomUUID();
    const repos = reposWith([{
      id: 'mixed',
      derive: async (context) => [
        ...await perListener().derive(context),
        { key: 'other-workspace', source: { client: 'public' }, targetListenerId: elsewhere.id, basis: [] },
        { key: 'unknown-source', source: { serviceId: unknown }, targetListenerId: elsewhere.id, basis: [] },
      ],
    }]);

    const listener = await repos.transaction((tx) => createListener(tx));

    expect((await flowsOf()).map(({ key }) => key)).toEqual([listener.id]);
    expect(logs).toEqual([
      expect.stringMatching(/^probe: .*other-workspace/) as unknown,
      expect.stringMatching(/^probe: .*unknown-source/) as unknown,
    ]);
  });

  it('given two workspaces, leaves the other workspace\'s derived flows untouched and lets derivers read only the written workspace', async () => {
    const reposB = reposWith([perListener()], workspaces.b.workspace.id);
    await createListener(reposB);
    const inB = await flowsOf(workspaces.b.workspace.id);
    const reposA = reposWith([perListener()]);

    const inA = await createListener(reposA);

    expect((await flowsOf()).map(({ key }) => key)).toEqual([inA.id]);
    expect(await flowsOf(workspaces.b.workspace.id)).toEqual(inB);
  });

  it('runs no deriver of an inactive extension, such as reverse-proxy when it is not active', () => {
    const coreOnly = createExtensionRegistry(
      BUILTIN_EXTENSIONS.filter(({ id }) => id === 'core'),
      { servers: BUILTIN_EXTENSION_SERVERS.filter(({ extension }) => extension === 'core') },
    );
    const derivers = (registry: typeof coreOnly) =>
      registry.flowDerivers().map(({ extension, deriver }) => `${extension}:${deriver.id}`);

    expect(derivers(BUILTIN_REGISTRY)).toEqual(['core:dns', 'reverse-proxy:routes']);
    expect(derivers(coreOnly)).toEqual(['core:dns']);
  });
});
