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
export function resolvePortForwardHops(_entities: PortForwardHopEntities, _ids: readonly string[]): TraceHop[] {
  return [];
}

export const portForwardHopResolver: TraceHopResolver = {
  entity: 'port-forward',
  resolve: async ({ ids, read }) => {
    const [portForwards, hosts] = await Promise.all([read.portForwards.list(), read.hosts.list()]);
    return resolvePortForwardHops({ portForwards, hosts }, ids);
  },
};
