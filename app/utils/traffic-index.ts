import type { Translate } from './traffic-graph';
import type { Selection } from './traffic-selection';
import type { Traffic, TrafficFlow } from '../../shared/contracts/traffic';

type Listener = Traffic['listeners'][number];

/** `443/tcp`. */
export const portLabel = ({ port, transport }: Listener): string => `${String(port)}/${transport}`;

/** Derived by which extension and deriver, or documented by hand. */
export const originLabel = (flow: TrafficFlow, t: Translate): string => (flow.origin === 'manual'
  ? t('traffic.origin.manual')
  : t('traffic.origin.derived', { extension: flow.extension, deriver: flow.deriver }));

/** Lookups over a traffic response, in its order: services by name, ports by port, flows as sent. */
export function indexTraffic(traffic: Traffic) {
  const hosts = new Map(traffic.hosts.map((host) => [host.id, host]));
  const services = new Map(traffic.services.map((service) => [service.id, service]));
  const listeners = new Map(traffic.listeners.map((listener) => [listener.id, listener]));
  const servicesByHost = Map.groupBy(traffic.services, ({ hostId }) => hostId);
  const portsByService = Map.groupBy(
    traffic.listeners.toSorted((a, b) => a.port - b.port || a.id.localeCompare(b.id)),
    ({ serviceId }) => serviceId,
  );
  const flowsByTarget = Map.groupBy(traffic.flows, ({ targetListenerId }) => targetListenerId);

  return {
    host: (id: string) => hosts.get(id),
    service: (id: string) => services.get(id),
    port: (id: string) => listeners.get(id),
    flow: (id: string) => traffic.flows.find((flow) => flow.id === id),
    servicesOf: (hostId: string | null) => servicesByHost.get(hostId) ?? [],
    portsOf: (serviceId: string) => portsByService.get(serviceId) ?? [],
    serviceOfPort: (listenerId: string) => services.get(listeners.get(listenerId)?.serviceId ?? ''),
    flowsInto: (listenerId: string) => flowsByTarget.get(listenerId) ?? [],
    flowsFrom: ({ type, id }: Pick<Selection, 'type' | 'id'>) => traffic.flows.filter(({ source }) => (type === 'client'
      ? source.type === 'client' && source.client === id
      : source.type === 'service' && source.serviceId === id)),
    sourceName: (flow: TrafficFlow, t: Translate) => (flow.source.type === 'client'
      ? t(`traffic.client.${flow.source.client}`)
      : services.get(flow.source.serviceId)?.name ?? ''),
  };
}

export type TrafficIndex = ReturnType<typeof indexTraffic>;

/** `Website 3000/tcp`: the service and port a flow reaches. */
export const targetName = (index: TrafficIndex, { targetListenerId }: TrafficFlow): string => {
  const target = index.port(targetListenerId);
  return `${index.serviceOfPort(targetListenerId)?.name ?? ''} ${target ? portLabel(target) : ''}`.trim();
};

/** What a selection is called in the panel's title and in announcements; undefined when it is not in the traffic. */
export function selectionName(index: TrafficIndex, { type, id }: Selection, t: Translate): string | undefined {
  switch (type) {
    case 'client':
      return t(`traffic.client.${id}`);
    case 'host':
      return index.host(id)?.name;
    case 'service':
      return index.service(id)?.name;
    case 'listener': {
      const port = index.port(id);
      return port && `${index.serviceOfPort(id)?.name ?? ''} ${portLabel(port)}`;
    }
    case 'flow': {
      const flow = index.flow(id);
      return flow && `${index.sourceName(flow, t)} → ${targetName(index, flow)}`;
    }
  }
}
