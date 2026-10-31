import type { Traffic, TrafficFlow } from '../../shared/contracts/traffic';
import type { Edge, Node } from '@vue-flow/core';
import type { ElkNode } from 'elkjs/lib/elk-api';

/** Translates a key with its parameters, and a count for plural forms: the app's `t`. */
export type Translate = (key: string, params?: Record<string, unknown>, plural?: number) => string;

/** The traffic graph as Vue Flow draws it. */
export interface TrafficLayout {
  nodes: Node[];
  edges: Edge[];
}

type Listener = Traffic['listeners'][number];
type Service = Traffic['services'][number];
type Client = 'public' | 'internal';

/** Sizes in px, matching the node templates in TrafficGraph.vue (1rem = 16px). */
export const SIZES = {
  client: { width: 160, height: 48 },
  service: { minWidth: 200, maxWidth: 320, header: 56, port: 28, padding: 8 },
  host: { top: 48, side: 16 },
  /** Average width of a character in the node titles. */
  character: 8,
} as const;

export const nodeIds = {
  client: (client: Client) => `client:${client}`,
  host: (id: string) => `host:${id}`,
  service: (id: string) => `service:${id}`,
  listener: (id: string) => `listener:${id}`,
  flow: (id: string) => `flow:${id}`,
};

const byPort = (a: Listener, b: Listener) => a.port - b.port || a.id.localeCompare(b.id);

const listenersByService = (traffic: Traffic) => {
  const grouped = Map.groupBy(traffic.listeners, ({ serviceId }) => serviceId);
  return (serviceId: string) => (grouped.get(serviceId) ?? []).toSorted(byPort);
};

const clientsOf = (traffic: Traffic): Client[] => (['public', 'internal'] as const)
  .filter((client) => traffic.flows.some(({ source }) => source.type === 'client' && source.client === client));

const serviceWidth = ({ name }: Service) => Math.min(
  SIZES.service.maxWidth,
  Math.max(SIZES.service.minWidth, name.length * SIZES.character + 2 * SIZES.service.padding * 2),
);

const portY = (index: number) => SIZES.service.header + index * SIZES.service.port + SIZES.service.port / 2;

const serviceNode = (service: Service, listeners: Listener[]): ElkNode => ({
  id: nodeIds.service(service.id),
  width: serviceWidth(service),
  height: SIZES.service.header + listeners.length * SIZES.service.port + SIZES.service.padding,
  // Ports sit at the rows the node template draws them in, on the left: flows come in from the left.
  layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
  ports: listeners.map((listener, index) => ({
    id: nodeIds.listener(listener.id),
    x: 0,
    y: portY(index),
    width: 1,
    height: 1,
    layoutOptions: { 'elk.port.side': 'WEST' },
  })),
});

const sourceOf = ({ source }: TrafficFlow) =>
  (source.type === 'client' ? nodeIds.client(source.client) : nodeIds.service(source.serviceId));

/** The traffic as an ELK graph: hosts holding services, services with their ports, flows as edges to ports. */
export function trafficToElk(traffic: Traffic): ElkNode {
  const listenersOf = listenersByService(traffic);
  const servicesOf = Map.groupBy(traffic.services, ({ hostId }) => hostId);
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': '32',
      'elk.layered.spacing.nodeNodeBetweenLayers': '64',
    },
    children: [
      ...clientsOf(traffic).map((client) => ({ id: nodeIds.client(client), ...SIZES.client })),
      ...traffic.hosts.map((host) => ({
        id: nodeIds.host(host.id),
        // ELK sizes a host around its services; one without services keeps this size.
        width: SIZES.service.minWidth,
        height: SIZES.host.top + SIZES.host.side,
        layoutOptions: {
          'elk.padding': `[top=${String(SIZES.host.top)},left=${String(SIZES.host.side)},`
            + `bottom=${String(SIZES.host.side)},right=${String(SIZES.host.side)}]`,
        },
        children: (servicesOf.get(host.id) ?? []).map((service) => serviceNode(service, listenersOf(service.id))),
      })),
      ...(servicesOf.get(null) ?? []).map((service) => serviceNode(service, listenersOf(service.id))),
    ],
    edges: traffic.flows.map((flow) => ({
      id: nodeIds.flow(flow.id),
      sources: [sourceOf(flow)],
      targets: [nodeIds.listener(flow.targetListenerId)],
    })),
  };
}

/** The laid-out ELK graph as Vue Flow nodes and edges, each with its accessible name. */
export function elkToVueFlow(traffic: Traffic, laidOut: ElkNode, t: Translate): TrafficLayout {
  const listenersOf = listenersByService(traffic);
  const hosts = new Map(traffic.hosts.map((host) => [nodeIds.host(host.id), host]));
  const services = new Map(traffic.services.map((service) => [nodeIds.service(service.id), service]));
  const hostName = new Map(traffic.hosts.map(({ id, name }) => [id, name]));
  const serviceName = new Map(traffic.services.map(({ id, name }) => [id, name]));
  const listeners = new Map(traffic.listeners.map((listener) => [listener.id, listener]));
  const clientName = (client: Client) => t(`traffic.client.${client}`);
  const box = ({ x = 0, y = 0, width = 0, height = 0 }: ElkNode) => ({ position: { x, y }, width, height });

  const toServiceNode = (child: ElkNode, service: Service, parentNode?: string): Node => {
    const ports = listenersOf(service.id);
    const host = service.hostId === null ? undefined : hostName.get(service.hostId);
    return {
      id: child.id,
      type: 'service',
      ...box(child),
      parentNode,
      ariaLabel: host === undefined
        ? t('traffic.node.externalService', { name: service.name, kind: service.kind, count: ports.length }, ports.length)
        : t('traffic.node.service', { name: service.name, kind: service.kind, host, count: ports.length }, ports.length),
      data: { service, listeners: ports },
    };
  };

  const nodes = (laidOut.children ?? []).flatMap((child): Node[] => {
    const host = hosts.get(child.id);
    if (host) {
      const count = child.children?.length ?? 0;
      return [
        {
          id: child.id,
          type: 'host',
          ...box(child),
          ariaLabel: t('traffic.node.host', { name: host.name, kind: host.kind, count }, count),
          data: { host },
        },
        ...(child.children ?? []).flatMap((grandchild) => {
          const service = services.get(grandchild.id);
          return service ? [toServiceNode(grandchild, service, child.id)] : [];
        }),
      ];
    }
    const service = services.get(child.id);
    if (service) {
      return [toServiceNode(child, service)];
    }
    const client = child.id.slice('client:'.length) as Client;
    return [{ id: child.id, type: 'client', ...box(child), ariaLabel: clientName(client), data: { client } }];
  });

  const edges = traffic.flows.map((flow): Edge => {
    const target = listeners.get(flow.targetListenerId);
    return {
      id: nodeIds.flow(flow.id),
      source: sourceOf(flow),
      target: nodeIds.service(target?.serviceId ?? ''),
      targetHandle: nodeIds.listener(flow.targetListenerId),
      type: 'smoothstep',
      ariaLabel: t('traffic.edge', {
        source: flow.source.type === 'client' ? clientName(flow.source.client) : serviceName.get(flow.source.serviceId),
        service: serviceName.get(target?.serviceId ?? ''),
        port: target ? `${String(target.port)}/${target.transport}` : '',
      }),
      data: { flow },
    };
  });

  return { nodes, edges };
}
