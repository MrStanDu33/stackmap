import type { Traffic } from '../../shared/contracts/traffic';

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

/** The demo stack's ids, by the demo stack's references, for the client-side tests and stories. */
export const DEMO_IDS = {
  hosts: { router: id(1), server: id(2) },
  services: { npm: id(10), weatherApi: id(11), website: id(12), database: id(13) },
  listeners: {
    npmHttp: id(20), npmAdmin: id(21), npmHttps: id(22), weatherApi: id(23), website: id(24), database: id(25),
  },
  flows: {
    internalHttp: id(30), internalAdmin: id(31), internalHttps: id(32), publicHttp: id(33), publicHttps: id(34),
    routeWebsite: id(35), routeAdmin: id(36), database: id(37), weatherApi: id(38),
  },
} as const;

const { hosts, services, listeners, flows } = DEMO_IDS;
const SITE_NAMES = ['app.homelab.example', 'homelab.example', 'www.homelab.example'];
const derived = (extension: string, deriver: string) =>
  ({ origin: 'derived' as const, extension, deriver, protocol: null, encrypted: null, purpose: null });
const fromClient = (client: 'public' | 'internal') => ({ type: 'client' as const, client });
const fromService = (serviceId: string) => ({ type: 'service' as const, serviceId });
const names = (hostnames: string[]) => ({ hostnames, hostnameCount: hostnames.length });

/**
 * What `GET /api/workspaces/:workspaceId/traffic` returns for the demo stack, with fixed ids. A test checks it against
 * the route (`demo-traffic.integration.test.ts`).
 */
export const DEMO_TRAFFIC: Traffic = {
  hosts: [
    { id: hosts.router, name: 'Edge router', kind: 'router' },
    { id: hosts.server, name: 'Home server', kind: 'physical' },
  ],
  services: [
    { id: services.npm, name: 'Nginx Proxy Manager', kind: 'reverse-proxy', hostId: hosts.server },
    { id: services.weatherApi, name: 'Weather API', kind: 'external-api', hostId: null },
    { id: services.website, name: 'Website', kind: 'app', hostId: hosts.server },
    { id: services.database, name: 'Website database', kind: 'database', hostId: hosts.server },
  ],
  listeners: [
    { id: listeners.npmHttp, serviceId: services.npm, port: 80, transport: 'tcp', protocol: 'http', publishedPort: 80 },
    { id: listeners.npmAdmin, serviceId: services.npm, port: 81, transport: 'tcp', protocol: 'http', publishedPort: 81 },
    { id: listeners.npmHttps, serviceId: services.npm, port: 443, transport: 'tcp', protocol: 'https', publishedPort: 443 },
    { id: listeners.weatherApi, serviceId: services.weatherApi, port: 443, transport: 'tcp', protocol: 'https', publishedPort: null },
    { id: listeners.website, serviceId: services.website, port: 3000, transport: 'tcp', protocol: 'http', publishedPort: null },
    { id: listeners.database, serviceId: services.database, port: 5432, transport: 'tcp', protocol: null, publishedPort: null },
  ],
  flows: [
    { id: flows.internalHttp, ...derived('core', 'dns'), source: fromClient('internal'), targetListenerId: listeners.npmHttp, ...names(['npm.homelab.example']) },
    { id: flows.internalHttps, ...derived('core', 'dns'), source: fromClient('internal'), targetListenerId: listeners.npmHttps, ...names(['npm.homelab.example']) },
    { id: flows.internalAdmin, ...derived('core', 'dns'), source: fromClient('internal'), targetListenerId: listeners.npmAdmin, ...names(['npm.homelab.example']) },
    { id: flows.publicHttp, ...derived('nat', 'port-forwards'), source: fromClient('public'), targetListenerId: listeners.npmHttp, ...names(SITE_NAMES) },
    { id: flows.publicHttps, ...derived('nat', 'port-forwards'), source: fromClient('public'), targetListenerId: listeners.npmHttps, ...names(SITE_NAMES) },
    { id: flows.routeWebsite, ...derived('reverse-proxy', 'routes'), source: fromService(services.npm), targetListenerId: listeners.website, ...names(SITE_NAMES) },
    { id: flows.routeAdmin, ...derived('reverse-proxy', 'routes'), source: fromService(services.npm), targetListenerId: listeners.npmAdmin, ...names(['npm.homelab.example']) },
    {
      id: flows.database, origin: 'manual', extension: null, deriver: null, source: fromService(services.website),
      targetListenerId: listeners.database, protocol: null, encrypted: null, purpose: 'Stores the site content', ...names([]),
    },
    {
      id: flows.weatherApi, origin: 'manual', extension: null, deriver: null, source: fromService(services.website),
      targetListenerId: listeners.weatherApi, protocol: null, encrypted: true, purpose: 'Fetches the forecasts', ...names([]),
    },
  ],
  truncated: false,
};
