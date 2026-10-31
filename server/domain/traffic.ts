import {
  MAX_TRAFFIC_FLOW_HOSTNAMES, MAX_TRAFFIC_FLOWS, MAX_TRAFFIC_HOSTS, MAX_TRAFFIC_LISTENERS, MAX_TRAFFIC_SERVICES,
} from '../../shared/contracts/traffic';

import type { TraceFlow } from './trace';
import type { Traffic, TrafficFlow } from '../../shared/contracts/traffic';

/** What a traffic graph is built from: the workspace's hosts, services, listeners and stored flows. */
export interface TrafficEntities {
  hosts: readonly { id: string; name: string; kind: string }[];
  services: readonly { id: string; name: string; kind: string; hostId: string | null }[];
  listeners: readonly {
    id: string;
    serviceId: string;
    port: number;
    transport: string;
    protocol: string | null;
    publishedPort: number | null;
  }[];
  flows: readonly TraceFlow[];
}

const byName = (a: { name: string; id: string }, b: { name: string; id: string }) =>
  a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id);

const byPort = (a: { port: number; id: string }, b: { port: number; id: string }) =>
  a.port - b.port || a.id.localeCompare(b.id);

const toFlow = (flow: TraceFlow, source: TrafficFlow['source']): TrafficFlow => ({
  id: flow.id,
  origin: flow.origin,
  extension: flow.extension,
  deriver: flow.deriver,
  source,
  targetListenerId: flow.targetListenerId,
  protocol: flow.protocol,
  encrypted: flow.encrypted,
  purpose: flow.purpose,
  hostnames: flow.hostnames.toSorted().slice(0, MAX_TRAFFIC_FLOW_HOSTNAMES),
  hostnameCount: flow.hostnames.length,
});

/** The traffic graph: sorted, capped, and with every reference resolving to an item it keeps. */
export function buildTraffic({ hosts, services, listeners, flows }: TrafficEntities): Traffic {
  let truncated = false;
  const cap = <T>(items: T[], max: number) => {
    truncated ||= items.length > max;
    return items.slice(0, max);
  };

  const keptHosts = cap(hosts.toSorted(byName), MAX_TRAFFIC_HOSTS).map(({ id, name, kind }) => ({ id, name, kind }));
  const hostIds = new Set(keptHosts.map(({ id }) => id));
  // A service on a host left out goes too, so the client never draws a box it cannot place.
  const keptServices = cap(services.filter(({ hostId }) => hostId === null || hostIds.has(hostId)).toSorted(byName),
    MAX_TRAFFIC_SERVICES).map(({ id, name, kind, hostId }) => ({ id, name, kind, hostId }));
  const listenersOf = Map.groupBy(listeners, ({ serviceId }) => serviceId);
  const keptListeners = cap(keptServices.flatMap(({ id }) => (listenersOf.get(id) ?? []).toSorted(byPort)),
    MAX_TRAFFIC_LISTENERS).map(({ id, serviceId, port, transport, protocol, publishedPort }) =>
    ({ id, serviceId, port, transport, protocol, publishedPort }));
  // Keyed by a flow's nullable source: a manual flow's service, or nothing for a client flow.
  const keptServiceIds = new Map<string | null, string>(keptServices.map(({ id }) => [id, id]));
  const listenerIds = new Set(keptListeners.map(({ id }) => id));
  const sourceOf = ({ sourceClient, sourceServiceId }: TraceFlow): TrafficFlow['source'] | undefined => {
    if (sourceClient !== null) {
      return { type: 'client', client: sourceClient };
    }
    const serviceId = keptServiceIds.get(sourceServiceId);
    return serviceId === undefined ? undefined : { type: 'service', serviceId };
  };
  const ordered = [
    ...flows.filter(({ origin }) => origin === 'derived'), ...flows.filter(({ origin }) => origin === 'manual'),
  ];
  const resolved = ordered.flatMap((flow) => {
    const source = sourceOf(flow);
    return source && listenerIds.has(flow.targetListenerId) ? [{ flow, source }] : [];
  });
  // Capped before mapping: only the kept flows' hostnames are sorted.
  const keptFlows = cap(resolved, MAX_TRAFFIC_FLOWS).map(({ flow, source }) => toFlow(flow, source));

  return { hosts: keptHosts, services: keptServices, listeners: keptListeners, flows: keptFlows, truncated };
}
