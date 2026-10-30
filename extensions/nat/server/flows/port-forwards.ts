import { DNS_VIEWS } from '@stackmap/extension-core/entities';
import { dnsNamesByAddress, listenerIndex } from '@stackmap/extension-core/flows';
import { cidrContains } from '@stackmap/extension-sdk/entities';

import type { PortForward } from '../../entities';
import type { Listener } from '@stackmap/extension-core/entities';
import type { AddressHolder, DnsFlowEntities } from '@stackmap/extension-core/flows';
import type { FlowClient, FlowDeriver, FlowDraft } from '@stackmap/extension-sdk/server';

/** What the port forward deriver reads: the forwards, and the DNS and listeners they lead to. */
export interface PortForwardFlowEntities extends Omit<DnsFlowEntities, 'listeners'> {
  listeners: readonly Pick<Listener, 'id' | 'serviceId' | 'bindAddress' | 'port' | 'publishedPort' | 'transport'>[];
  portForwards: readonly Pick<
    PortForward, 'id' | 'hostId' | 'externalAddress' | 'transport' | 'internalAddress' | 'internalPort'
  >[];
}

/** Addresses the internet cannot reach directly: private, carrier-grade NAT, loopback and link-local ranges. */
const NON_PUBLIC = [
  '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16',
  '::1/128', 'fc00::/7', 'fe80::/10',
];

const isPublic = (address: string) => !NON_PUBLIC.some((range) => cidrContains(range, address));

/**
 * One flow per (forward, listener it reaches), named by the DNS of its external address. A forward on a public
 * address is exposed to the internet whether or not DNS names it, so the flow is given without hostnames too; one on
 * a private or carrier-grade NAT address only reaches internal clients.
 */
export function derivePortForwardFlows(entities: PortForwardFlowEntities): FlowDraft[] {
  const listenersAt = listenerIndex(entities);
  const hosts = new Map(entities.hosts.map((host) => [host.id, host]));
  const names = new Map(DNS_VIEWS.map((view) => [view, dnsNamesByAddress(entities, view)]));
  return entities.portForwards.flatMap((forward) => {
    const router = hosts.get(forward.hostId);
    // A forward whose host no longer holds its address forwards nothing (an insight can flag it).
    if (!router?.addresses.some(({ address }) => address === forward.externalAddress)) {
      return [];
    }
    const client: FlowClient = isPublic(forward.externalAddress) ? 'public' : 'internal';
    const named = names.get(client)?.get(forward.externalAddress);
    const networks = new Set(router.addresses.flatMap(({ networkId }) => (networkId === null ? [] : [networkId])));
    // The forwarding host itself, or a holder on one of its networks; an undocumented network never hides exposure.
    const reaches = ({ hostId, networkId }: AddressHolder) => hostId === forward.hostId || networkId === null
      || networks.size === 0 || networks.has(networkId);
    return listenersAt(forward.internalAddress, reaches)
      .filter(({ transport, port, publishedPort }) =>
        transport === forward.transport && (publishedPort ?? port) === forward.internalPort)
      .map((listener) => ({
        key: `${forward.id}:${listener.id}`,
        source: { client },
        targetListenerId: listener.id,
        hostnames: named?.hostnames ?? [],
        basis: [
          { entity: 'port-forward', id: forward.id },
          ...(named?.recordIds ?? []).map((id) => ({ entity: 'dns-record', id })),
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
