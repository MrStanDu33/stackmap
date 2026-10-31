import { describe, expect, it } from 'vitest';

import { traceWorkspace } from './traces';
import { DIALECTS } from '../../tests/support/databases';
import { BUILTIN_REGISTRY, useTestWorkspaces } from '../../tests/support/workspaces';
import { seedDemoStack } from '../demo/demo-stack';

import type { Dialect } from '../../tests/support/databases';

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
});
