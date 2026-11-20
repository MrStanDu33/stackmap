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
export function parseTrafficSelected(_raw: unknown, _traffic: Traffic): Selection | null {
  return null;
}

/** What the traffic draws that the palette can select: each host, service and port's id, to its `?selected=` value. */
export function trafficDrawn(_traffic: Traffic): Record<string, string> {
  return {};
}
