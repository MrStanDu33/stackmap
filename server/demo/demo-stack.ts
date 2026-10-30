import type {
  DnsRecord, DnsRecordInput, Domain, DomainInput, Host, HostInput, Listener, ListenerInput, Network, NetworkInput,
  Service, ServiceInput, Site, SiteInput,
} from '../../extensions/core/entities';
import type { ProxyRoute, ProxyRouteInput } from '../../extensions/reverse-proxy/entities';
import type { WorkspaceRepositories } from '../repositories';

/**
 * A fictional home lab, with references by name instead of ids: tests use it, and the app seeds it into its demo
 * workspace.
 */
export interface DemoStack {
  sites: Record<string, SiteInput>;
  networks: Record<string, Omit<NetworkInput, 'siteId'> & { site: string | null }>;
  hosts: Record<string, Omit<HostInput, 'siteId' | 'addresses'> & {
    site: string | null;
    addresses: { address: string; network: string | null }[];
  }>;
  services: Record<string, Omit<ServiceInput, 'hostId'> & { host: string | null }>;
  listeners: Record<string, Omit<ListenerInput, 'serviceId'> & { service: string }>;
  domains: Record<string, DomainInput>;
  dnsRecords: Record<string, Omit<DnsRecordInput, 'domainId'> & { domain: string }>;
  proxyRoutes: Record<string, Omit<ProxyRouteInput, 'proxyServiceId' | 'upstreamListenerId'> & {
    proxy: string;
    upstream: string;
  }>;
}

/** The created entities, by the demo stack's references. */
export interface SeededDemoStack {
  sites: Record<string, Site>;
  networks: Record<string, Network>;
  hosts: Record<string, Host>;
  services: Record<string, Service>;
  listeners: Record<string, Listener>;
  domains: Record<string, Domain>;
  dnsRecords: Record<string, DnsRecord>;
  proxyRoutes: Record<string, ProxyRoute>;
}

/** A home server behind an edge router: a website and its database behind Nginx Proxy Manager, on homelab.example. */
export const DEMO_STACK: DemoStack = {
  sites: {
    home: { name: 'Home lab' },
  },
  networks: {
    lan: { name: 'Home LAN', kind: 'lan', cidr: '10.0.10.0/24', vlan: 10, site: 'home' },
    internet: { name: 'Internet', kind: 'public', cidr: null, site: null },
  },
  hosts: {
    router: {
      name: 'Edge router',
      kind: 'router',
      site: 'home',
      addresses: [{ address: '10.0.10.1', network: 'lan' }, { address: '203.0.113.10', network: 'internet' }],
    },
    server: {
      name: 'Home server',
      kind: 'physical',
      os: 'Debian 13',
      site: 'home',
      addresses: [{ address: '10.0.10.20', network: 'lan' }],
    },
  },
  services: {
    npm: { name: 'Nginx Proxy Manager', kind: 'reverse-proxy', host: 'server', image: 'jc21/nginx-proxy-manager:2', containerName: 'npm' },
    website: { name: 'Website', kind: 'app', host: 'server', image: 'homelab/website:1.4', containerName: 'website' },
    database: { name: 'Website database', kind: 'database', host: 'server', image: 'postgres:17', containerName: 'website-db' },
    weatherApi: { name: 'Weather API', kind: 'external-api', host: null, notes: 'Called by the website for forecasts.' },
  },
  listeners: {
    npmHttp: { service: 'npm', port: 80, transport: 'tcp', protocol: 'http', bindAddress: '0.0.0.0', publishedPort: 80 },
    npmHttps: { service: 'npm', port: 443, transport: 'tcp', protocol: 'https', bindAddress: '0.0.0.0', publishedPort: 443 },
    npmAdmin: { service: 'npm', port: 81, transport: 'tcp', protocol: 'http', bindAddress: '10.0.10.20', publishedPort: 81 },
    // Reachable only on the containers' network.
    website: { service: 'website', port: 3000, transport: 'tcp', protocol: 'http', bindAddress: null, publishedPort: null },
    database: { service: 'database', port: 5432, transport: 'tcp', protocol: null, bindAddress: null, publishedPort: null },
    weatherApi: { service: 'weatherApi', port: 443, transport: 'tcp', protocol: 'https', bindAddress: null, publishedPort: null },
  },
  domains: {
    homelab: { name: 'homelab.example' },
  },
  dnsRecords: {
    apex: { domain: 'homelab', name: '@', type: 'A', value: '203.0.113.10' },
    app: { domain: 'homelab', name: 'app', type: 'A', value: '203.0.113.10' },
    www: { domain: 'homelab', name: 'www', type: 'CNAME', value: 'homelab.example' },
    npm: { domain: 'homelab', name: 'npm', type: 'A', value: '10.0.10.20', view: 'internal' },
    spf: { domain: 'homelab', name: '@', type: 'TXT', value: 'v=spf1 -all' },
  },
  proxyRoutes: {
    website: {
      proxy: 'npm',
      hostnames: ['homelab.example', 'www.homelab.example', 'app.homelab.example'],
      upstream: 'website',
      forceSsl: true,
    },
    npmAdmin: { proxy: 'npm', hostnames: ['npm.homelab.example'], upstream: 'npmAdmin' },
  },
};

/** Creates each entry in order, keeping the created entities by reference. */
async function createEach<I, E>(
  entries: Record<string, I>,
  create: (input: I) => Promise<E>,
): Promise<Record<string, E>> {
  const created: Record<string, E> = {};
  for (const [reference, input] of Object.entries(entries)) {
    created[reference] = await create(input);
  }
  return created;
}

function idOf(created: Record<string, { id: string }>, reference: string): string;
function idOf(created: Record<string, { id: string }>, reference: string | null): string | null;
function idOf(created: Record<string, { id: string }>, reference: string | null): string | null {
  if (reference === null) {
    return null;
  }
  const entity = created[reference];
  if (!entity) {
    throw new Error(`The demo stack refers to "${reference}", which it does not declare.`);
  }
  return entity.id;
}

/** Creates the demo stack in the repositories' workspace, in one transaction. */
export function seedDemoStack(repos: WorkspaceRepositories): Promise<SeededDemoStack> {
  return repos.transaction(async (tx) => {
    const sites = await createEach(DEMO_STACK.sites, (site) => tx.sites.create(site));
    const networks = await createEach(DEMO_STACK.networks, ({ site, ...network }) =>
      tx.networks.create({ ...network, siteId: idOf(sites, site) }));
    const hosts = await createEach(DEMO_STACK.hosts, ({ site, addresses, ...host }) => tx.hosts.create({
      ...host,
      siteId: idOf(sites, site),
      addresses: addresses.map(({ address, network }) => ({ address, networkId: idOf(networks, network) })),
    }));
    const services = await createEach(DEMO_STACK.services, ({ host, ...service }) =>
      tx.services.create({ ...service, hostId: idOf(hosts, host) }));
    const listeners = await createEach(DEMO_STACK.listeners, ({ service, ...listener }) =>
      tx.listeners.create({ ...listener, serviceId: idOf(services, service) }));
    const domains = await createEach(DEMO_STACK.domains, (domain) => tx.domains.create(domain));
    const dnsRecords = await createEach(DEMO_STACK.dnsRecords, ({ domain, ...record }) =>
      tx.dnsRecords.create({ ...record, domainId: idOf(domains, domain) }));
    const proxyRoutes = await createEach(DEMO_STACK.proxyRoutes, ({ proxy, upstream, ...route }) =>
      tx.proxyRoutes.create({
        ...route,
        proxyServiceId: idOf(services, proxy),
        upstreamListenerId: idOf(listeners, upstream),
      }));
    return { sites, networks, hosts, services, listeners, domains, dnsRecords, proxyRoutes };
  });
}
