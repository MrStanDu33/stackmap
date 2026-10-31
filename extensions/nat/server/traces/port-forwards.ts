import type { PortForward } from '../../entities';
import type { Host } from '@stackmap/extension-core/entities';
import type { TraceHop, TraceHopResolver } from '@stackmap/extension-sdk/server';

/** What the port forward resolver reads: the forwards and the routers holding them. */
export interface PortForwardHopEntities {
  portForwards: readonly Pick<
    PortForward, 'id' | 'hostId' | 'externalAddress' | 'externalPort' | 'transport' | 'internalAddress' | 'internalPort'
  >[];
  hosts: readonly Pick<Host, 'id' | 'name'>[];
}

/** One network hop per forward, with the external port a client connects to. */
export function resolvePortForwardHops(
  { portForwards, hosts }: PortForwardHopEntities,
  ids: readonly string[],
): TraceHop[] {
  const given = new Set(ids);
  const hostNames = new Map(hosts.map(({ id, name }) => [id, name]));
  const endpoint = (address: string, port: number) =>
    (address.includes(':') ? `[${address}]:${String(port)}` : `${address}:${String(port)}`);
  return portForwards.filter(({ id }) => given.has(id)).map((forward) => ({
    entity: 'port-forward',
    id: forward.id,
    stage: 'network',
    label: 'extensions.nat.trace.forward',
    params: {
      router: hostNames.get(forward.hostId) ?? '',
      external: `${endpoint(forward.externalAddress, forward.externalPort)}/${forward.transport}`,
      internal: endpoint(forward.internalAddress, forward.internalPort),
    },
    port: forward.externalPort,
  }));
}

export const portForwardHopResolver: TraceHopResolver = {
  entity: 'port-forward',
  resolve: async ({ ids, read }) => {
    const [portForwards, hosts] = await Promise.all([read.portForwards.list(), read.hosts.list()]);
    return resolvePortForwardHops({ portForwards, hosts }, ids);
  },
};
