import { dnsNamesByAddress, reachableListeners } from '@stackmap/extension-core/flows';

import type { PortForward } from '../../entities';
import type { Listener } from '@stackmap/extension-core/entities';
import type { DnsFlowEntities } from '@stackmap/extension-core/flows';
import type { FlowDeriver, FlowDraft } from '@stackmap/extension-sdk/server';

/** What the port forward deriver reads: the forwards, and the DNS and listeners they lead to. */
export interface PortForwardFlowEntities extends Omit<DnsFlowEntities, 'listeners'> {
  listeners: readonly Pick<Listener, 'id' | 'serviceId' | 'bindAddress' | 'port' | 'publishedPort' | 'transport'>[];
  portForwards: readonly Pick<
    PortForward, 'id' | 'externalAddress' | 'transport' | 'internalAddress' | 'internalPort'
  >[];
}

/** One flow per (forward, listener it reaches), from the public client, named by the public DNS of its address. */
export function derivePortForwardFlows(entities: PortForwardFlowEntities): FlowDraft[] {
  // A forwarded port is exposed whether or not DNS names the address: the flow is given without hostnames too.
  const publicNames = dnsNamesByAddress(entities, 'public');
  return entities.portForwards.flatMap((forward) => {
    const names = publicNames.get(forward.externalAddress) ?? { hostnames: [], recordIds: [] };
    return reachableListeners(entities, forward.internalAddress)
      .filter(({ transport, port, publishedPort }) =>
        transport === forward.transport && (publishedPort ?? port) === forward.internalPort)
      .map((listener) => ({
        key: `${forward.id}:${listener.id}`,
        source: { client: 'public' as const },
        targetListenerId: listener.id,
        hostnames: names.hostnames,
        basis: [
          { entity: 'port-forward', id: forward.id },
          ...names.recordIds.map((id) => ({ entity: 'dns-record', id })),
        ],
      }));
  });
}

export const portForwardFlowDeriver: FlowDeriver = {
  id: 'port-forwards',
  derive: async ({ read }) => {
    const [domains, dnsRecords, hosts, services, listeners, portForwards] = await Promise.all([
      read.domains.list(), read.dnsRecords.list(), read.hosts.list(), read.services.list(), read.listeners.list(),
      read.portForwards.list(),
    ]);
    return derivePortForwardFlows({ domains, dnsRecords, hosts, services, listeners, portForwards });
  },
};
