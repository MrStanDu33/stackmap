import type { DnsFlowEntities } from './dns';
import type { Listener } from '../../entities';
import type { DnsView } from '../../entities/dns-record';

export { deriveDnsFlows, dnsFlowDeriver } from './dns';
export type { DnsFlowEntities } from './dns';

/** The hostnames of a view that resolve to an address, through CNAMEs, and the records used. */
export interface AddressNames {
  hostnames: string[];
  recordIds: string[];
}

/**
 * The listeners reachable at an address: on the hosts holding it, bound to it or to every address of its IP
 * version. A null bind address (container network, external service) is never reachable.
 */
export function reachableListeners(
  _entities: Pick<DnsFlowEntities, 'hosts' | 'services' | 'listeners'>,
  _address: string,
): Pick<Listener, 'id' | 'serviceId' | 'bindAddress'>[] {
  throw new Error('Not implemented');
}

/** For each address, the hostnames of a view resolving to it (A/AAAA, through CNAMEs of the same view). */
export function dnsNamesByAddress(
  _entities: Pick<DnsFlowEntities, 'domains' | 'dnsRecords'>,
  _view: DnsView,
): Map<string, AddressNames> {
  throw new Error('Not implemented');
}
