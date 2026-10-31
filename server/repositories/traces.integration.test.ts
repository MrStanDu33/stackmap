import { describe, expect, it } from 'vitest';

import { traceWorkspace } from './traces';
import { DIALECTS } from '../../tests/support/databases';
import { BUILTIN_REGISTRY, useTestWorkspaces } from '../../tests/support/workspaces';
import { seedDemoStack } from '../demo/demo-stack';

import type { Dialect } from '../../tests/support/databases';
import type { RegisteredTraceHopResolver } from '../extensions/registry';
import type { FlowReader } from '@stackmap/extension-sdk/server';

const silent = () => ({ info: () => undefined, warn: () => undefined, error: () => undefined });

describe.each(DIALECTS)('traceWorkspace on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);

  it('given two workspaces, traces one without anything of the other', async () => {
    const { db, a, b } = workspaces;
    const seededA = await seedDemoStack(a.repos);
    await seedDemoStack(b.repos);
    const listenersOfA = new Set(Object.values(seededA.listeners).map(({ id }) => id));
    const flowsOfB = new Set([
      ...(await b.repos.flows.list()).map(({ id }) => id),
      ...(await db.selectFrom('derived_flow').select('id').where('workspaceId', '=', b.workspace.id).execute())
        .map(({ id }) => id),
    ]);

    const trace = await traceWorkspace(
      { db: db, repos: a.repos, workspaceId: a.workspace.id },
      { hostname: 'app.homelab.example', port: null, client: 'public' },
      { resolvers: BUILTIN_REGISTRY.traceHopResolvers(), logger: silent },
    );

    expect(trace.steps.length).toBeGreaterThan(0);
    expect(trace.nodes.filter(({ type }) => type === 'listener').every(({ id }) => listenersOfA.has(id))).toBe(true);
    expect(trace.steps.some(({ flow }) => flowsOfB.has(flow.id))).toBe(false);
  });

  it('given several steps through the same entities, lists each table once per trace', async () => {
    const { db, a } = workspaces;
    await seedDemoStack(a.repos);
    const listed: string[] = [];
    const counted = Object.fromEntries(Object.entries(a.repos).map(([key, repository]) => [key, key === 'transaction'
      ? repository
      : {
          ...(repository as object),
          list: (...args: unknown[]) => {
            listed.push(key);
            return (repository as { list: (...rest: unknown[]) => Promise<unknown> }).list(...args);
          },
        }])) as unknown as typeof a.repos;

    const trace = await traceWorkspace(
      { db, repos: counted, workspaceId: a.workspace.id },
      { hostname: 'app.homelab.example', port: null, client: 'public' },
      { resolvers: BUILTIN_REGISTRY.traceHopResolvers(), logger: silent },
    );

    expect(trace.steps.length).toBeGreaterThan(3);
    expect(listed.filter((key) => listed.indexOf(key) !== listed.lastIndexOf(key))).toEqual([]);
  });

  it('gives resolvers a frozen reader that refuses reads once their call timed out', async () => {
    const { db, a } = workspaces;
    await seedDemoStack(a.repos);
    let kept: FlowReader | undefined;
    const late = Promise.withResolvers<unknown>();
    const stuck: RegisteredTraceHopResolver = {
      extension: 'nat',
      resolver: {
        entity: 'port-forward',
        resolve: ({ read }) => {
          kept = read;
          setTimeout(() => {
            late.resolve(read.hosts.list().catch((error: unknown) => error));
          }, 50);
          return new Promise<never>(() => undefined);
        },
      },
    };

    await traceWorkspace(
      { db, repos: a.repos, workspaceId: a.workspace.id },
      { hostname: 'app.homelab.example', port: 443, client: 'public' },
      { resolvers: [stuck], logger: silent, timeoutMs: 10 },
    );

    expect(Object.isFrozen(kept)).toBe(true);
    expect(Object.isFrozen(kept?.hosts)).toBe(true);
    expect(await late.promise).toEqual(new Error('trace hop resolver "port-forward" timed out: its reads are refused'));
  });
});
