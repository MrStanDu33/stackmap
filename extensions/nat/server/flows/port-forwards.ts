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
export function derivePortForwardFlows(_entities: PortForwardFlowEntities): FlowDraft[] {
  throw new Error('Not implemented');
}

export const portForwardFlowDeriver: FlowDeriver = {
  id: 'port-forwards',
  derive: () => Promise.reject(new Error('Not implemented')),
};
