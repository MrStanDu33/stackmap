import { FLOW_CLIENTS } from '@stackmap/extension-sdk/server';

import type { Traffic, TrafficFlow } from '../../shared/contracts/traffic';

/** What is selected in the Traffic view: a client (`public` or `internal`), a host, a service, a port or a flow. */
export interface Selection {
  type: 'client' | 'host' | 'service' | 'listener' | 'flow';
  id: string;
}

/** The flows to highlight for a selection: those in or out of it, or the flow itself. */
export function relatedFlowIds(traffic: Traffic, selection: Selection): Set<string> {
  const serviceOf = new Map(traffic.listeners.map(({ id, serviceId }) => [id, serviceId]));
  const touches = (serviceIds: Set<string>) => ({ source, targetListenerId }: TrafficFlow) =>
    (source.type === 'service' && serviceIds.has(source.serviceId))
    || serviceIds.has(serviceOf.get(targetListenerId) ?? '');
  const matches: Record<Selection['type'], (flow: TrafficFlow) => boolean> = {
    client: ({ source }) => source.type === 'client' && source.client === selection.id,
    host: touches(new Set(traffic.services.filter(({ hostId }) => hostId === selection.id).map(({ id }) => id))),
    service: touches(new Set([selection.id])),
    listener: ({ targetListenerId }) => targetListenerId === selection.id,
    flow: ({ id }) => id === selection.id,
  };
  return new Set(traffic.flows.filter(matches[selection.type]).map(({ id }) => id));
}

/** `?selected=` as a selection, when it names something the traffic draws. */
export function parseTrafficSelected(raw: unknown, traffic: Traffic): Selection | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const separator = raw.indexOf(':');
  const type = raw.slice(0, separator);
  const id = raw.slice(separator + 1);
  const ids: Record<Selection['type'], () => readonly string[]> = {
    client: () => FLOW_CLIENTS,
    host: () => traffic.hosts.map((host) => host.id),
    service: () => traffic.services.map((service) => service.id),
    listener: () => traffic.listeners.map((listener) => listener.id),
    flow: () => traffic.flows.map((flow) => flow.id),
  };
  const known = separator > 0 && Object.hasOwn(ids, type) ? ids[type as Selection['type']]() : [];
  return known.includes(id) ? { type: type as Selection['type'], id } : null;
}

/** What the traffic draws that the palette can select: each host, service and port's id, to its `?selected=` value. */
export function trafficDrawn(traffic: Traffic): Record<string, string> {
  const drawn: [string, string][] = [
    ...traffic.hosts.map(({ id }): [string, string] => [id, `host:${id}`]),
    ...traffic.services.map(({ id }): [string, string] => [id, `service:${id}`]),
    ...traffic.listeners.map(({ id }): [string, string] => [id, `listener:${id}`]),
  ];
  return Object.fromEntries(drawn);
}
