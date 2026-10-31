import { DEMO_IDS, DEMO_TRAFFIC } from './demo-traffic';

import type { Trace, TraceNode, TraceStep } from '../../shared/contracts/traces';

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const { hosts, services, listeners, flows } = DEMO_IDS;

/** The ids of the entities the demo trace's hops describe. */
export const DEMO_HOP_IDS = {
  appRecord: id(40), forwardHttp: id(41), forwardHttps: id(42), routeWebsite: id(43),
} as const;

const listenerNode = (listenerId: string): TraceNode => {
  const listener = DEMO_TRAFFIC.listeners.find(({ id: candidate }) => candidate === listenerId);
  const service = DEMO_TRAFFIC.services.find(({ id: candidate }) => candidate === listener?.serviceId);
  if (!listener || !service) {
    throw new Error(`No listener ${listenerId} in the demo traffic`);
  }
  return {
    id: listener.id,
    type: 'listener',
    listener: {
      id: listener.id,
      port: listener.port,
      transport: listener.transport,
      protocol: listener.protocol,
      publishedPort: listener.publishedPort,
      serviceId: service.id,
      serviceName: service.name,
      hostId: service.hostId,
      hostName: service.hostId === hosts.server ? 'Home server' : null,
    },
  };
};

const derived = (flowId: string, extension: string, deriver: string) => ({
  id: flowId, origin: 'derived' as const, extension, deriver, protocol: null, encrypted: null, purpose: null,
});
const manual = (flowId: string, purpose: string, encrypted: boolean | null) => ({
  id: flowId, origin: 'manual' as const, extension: null, deriver: null, protocol: null, encrypted, purpose,
});

const entry = (flowId: string, target: string, forward: string, port: number): TraceStep => ({
  id: `${flowId}:client`,
  source: 'client',
  target,
  role: 'request',
  depth: 0,
  cycle: false,
  flow: derived(flowId, 'nat', 'port-forwards'),
  hops: [
    {
      entity: 'dns-record', id: DEMO_HOP_IDS.appRecord, stage: 'dns', label: 'extensions.core.trace.address.public',
      params: { name: 'app.homelab.example', address: '203.0.113.10' },
    },
    {
      entity: 'port-forward', id: forward, stage: 'network', label: 'extensions.nat.trace.forward', port,
      params: { router: 'Edge router', external: `203.0.113.10:${String(port)}/tcp`, internal: `10.0.10.20:${String(port)}` },
    },
  ],
});

const route = (source: string): TraceStep => ({
  id: `${flows.routeWebsite}:${source}`,
  source,
  target: listeners.website,
  role: 'request',
  depth: 0,
  cycle: false,
  flow: derived(flows.routeWebsite, 'reverse-proxy', 'routes'),
  hops: [{
    entity: 'route', id: DEMO_HOP_IDS.routeWebsite, stage: 'proxy', label: 'extensions.reverse-proxy.trace.route',
    params: { proxy: 'Nginx Proxy Manager', hostname: 'app.homelab.example' },
  }],
});

const dependency = (flow: ReturnType<typeof manual>, target: string): TraceStep => ({
  id: `${flow.id}:${listeners.website}`,
  source: listeners.website,
  target,
  role: 'dependency',
  depth: 1,
  cycle: false,
  flow,
  hops: [],
});

/**
 * What `GET /api/workspaces/:workspaceId/trace?hostname=app.homelab.example` returns for the demo stack, with the
 * fixed ids of `DEMO_TRAFFIC`. A test checks it against the route (`demo-trace.integration.test.ts`).
 */
export const DEMO_TRACE: Trace = {
  hostname: 'app.homelab.example',
  port: null,
  client: 'public',
  truncated: false,
  nodes: [
    { id: 'client', type: 'client' },
    ...[listeners.npmHttp, listeners.npmHttps, listeners.website, listeners.database, listeners.weatherApi]
      .map(listenerNode),
  ],
  steps: [
    entry(flows.publicHttp, listeners.npmHttp, DEMO_HOP_IDS.forwardHttp, 80),
    entry(flows.publicHttps, listeners.npmHttps, DEMO_HOP_IDS.forwardHttps, 443),
    route(listeners.npmHttp),
    route(listeners.npmHttps),
    dependency(manual(flows.database, 'Stores the site content', null), listeners.database),
    dependency(manual(flows.weatherApi, 'Fetches the forecasts', true), listeners.weatherApi),
  ],
};

/** Nothing serves the name: the trace holds only the client. */
export const NOTHING_TRACE: Trace = {
  hostname: 'nowhere.homelab.example', port: null, client: 'public', truncated: false,
  nodes: [{ id: 'client', type: 'client' }], steps: [],
};

export { services as DEMO_SERVICE_IDS };
