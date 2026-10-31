import { expect, it } from 'vitest';

import { DEMO_TRACE } from './demo-trace';
import { BUILTIN_REGISTRY, useTestWorkspaces } from './workspaces';
import { seedDemoStack } from '../../server/demo/demo-stack';
import { loggerFor } from '../../server/extensions/runtime';
import { traceWorkspace } from '../../server/repositories/traces';

import type { Trace } from '../../shared/contracts/traces';

/** The trace with every id replaced by the listener it is (service:port), so two seeds compare equal. */
const byName = ({ nodes, steps, ...trace }: Trace) => {
  const names = new Map(nodes.map((node) => [
    node.id,
    node.type === 'client' ? 'client' : `${node.listener.serviceName}:${String(node.listener.port)}`,
  ]));
  return {
    ...trace,
    nodes: nodes.map((node) => (node.type === 'client'
      ? node
      : { name: names.get(node.id), ...node.listener, id: undefined, serviceId: undefined, hostId: undefined })),
    steps: steps.map(({ id: _id, source, target, flow, hops, ...step }) => ({
      ...step,
      source: names.get(source),
      target: names.get(target),
      flow: { ...flow, id: undefined },
      hops: hops.map(({ id: _hop, ...hop }) => hop),
    })),
  };
};

const workspaces = useTestWorkspaces('sqlite');

it('the demo trace fixture matches what the trace route computes for app.homelab.example', async () => {
  await seedDemoStack(workspaces.a.repos);
  const { repos, workspace } = workspaces.a;

  const trace = await traceWorkspace(
    { db: workspaces.db, repos, workspaceId: workspace.id },
    { hostname: 'app.homelab.example', port: null, client: 'public' },
    { resolvers: BUILTIN_REGISTRY.traceHopResolvers(), logger: loggerFor },
  );

  expect(byName(DEMO_TRACE)).toEqual(byName(trace));
});
