import { expect, it } from 'vitest';

import { DEMO_TRAFFIC } from './demo-traffic';
import { useTestWorkspaces } from './workspaces';
import { seedDemoStack } from '../../server/demo/demo-stack';
import { readTraffic } from '../../server/repositories/traffic';

import type { Traffic } from '../../shared/contracts/traffic';

/** The traffic with every id replaced by the name of what it points at, so two seeds compare equal. */
const byName = ({ hosts, services, listeners, flows, truncated }: Traffic) => {
  const names = new Map<string, string>([
    ...hosts.map(({ id, name }): [string, string] => [id, name]),
    ...services.map(({ id, name }): [string, string] => [id, name]),
  ]);
  const listenerName = new Map(listeners.map(({ id, serviceId, port }) =>
    [id, `${names.get(serviceId) ?? ''}:${String(port)}`]));
  return {
    hosts: hosts.map(({ id: _id, ...host }) => host),
    services: services.map(({ id: _id, hostId, ...service }) => ({ ...service, host: hostId && names.get(hostId) })),
    listeners: listeners.map(({ id, serviceId: _serviceId, ...listener }) =>
      ({ ...listener, name: listenerName.get(id) })),
    flows: flows.map(({ id: _id, source, targetListenerId, ...flow }) => ({
      ...flow,
      source: source.type === 'client' ? source.client : names.get(source.serviceId),
      target: listenerName.get(targetListenerId),
    })),
    truncated,
  };
};

const workspaces = useTestWorkspaces('sqlite');

it('the demo traffic fixture matches what the traffic route reads for the demo stack', async () => {
  await seedDemoStack(workspaces.a.repos);

  const { repos, workspace } = workspaces.a;
  const traffic = await readTraffic({ db: workspaces.db, repos, workspaceId: workspace.id });

  expect(byName(DEMO_TRAFFIC)).toEqual(byName(traffic));
});
