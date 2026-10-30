import { describe, expect, it } from 'vitest';

import { DEMO_STACK } from './demo-stack';
import { isFictionalDnsName, isFictionalIp } from '../../tests/support/fictional';

const listenersOf = (service: string) => Object.values(DEMO_STACK.listeners)
  .filter((listener) => listener.service === service)
  .map(({ port, protocol, bindAddress, publishedPort }) => ({ port, protocol, bindAddress, publishedPort }));

describe('demo stack', () => {
  it('describes a home lab: a site, the LAN and the Internet, the edge router and the home server', () => {
    expect(DEMO_STACK.sites).toEqual({ home: { name: 'Home lab' } });
    expect(DEMO_STACK.networks).toMatchObject({
      lan: { name: 'Home LAN', kind: 'lan', cidr: '10.0.10.0/24', vlan: 10, site: 'home' },
      internet: { name: 'Internet', kind: 'public', site: null },
    });
    expect(DEMO_STACK.hosts).toMatchObject({
      router: {
        name: 'Edge router',
        kind: 'router',
        site: 'home',
        addresses: [{ address: '10.0.10.1', network: 'lan' }, { address: '203.0.113.10', network: 'internet' }],
      },
      server: { name: 'Home server', kind: 'physical', site: 'home', addresses: [{ address: '10.0.10.20', network: 'lan' }] },
    });
  });

  it('runs Nginx Proxy Manager on 80, 443 and the admin port 81 bound to the LAN address', () => {
    expect(DEMO_STACK.services.npm).toMatchObject({ name: 'Nginx Proxy Manager', kind: 'reverse-proxy', host: 'server' });
    expect(listenersOf('npm')).toEqual([
      { port: 80, protocol: 'http', bindAddress: '0.0.0.0', publishedPort: 80 },
      { port: 443, protocol: 'https', bindAddress: '0.0.0.0', publishedPort: 443 },
      { port: 81, protocol: 'http', bindAddress: '10.0.10.20', publishedPort: 81 },
    ]);
  });

  it('runs the website on internal port 3000 and its database on internal port 5432, and calls the Weather API on 443', () => {
    expect(DEMO_STACK.services).toMatchObject({
      website: { name: 'Website', kind: 'app', host: 'server' },
      database: { name: 'Website database', kind: 'database', host: 'server' },
      weatherApi: { name: 'Weather API', kind: 'external-api', host: null },
    });
    expect(listenersOf('website')).toEqual([{ port: 3000, protocol: 'http', bindAddress: null, publishedPort: null }]);
    expect(listenersOf('database')).toEqual([{ port: 5432, protocol: null, bindAddress: null, publishedPort: null }]);
    expect(listenersOf('weatherApi')).toEqual([{ port: 443, protocol: 'https', bindAddress: null, publishedPort: null }]);
  });

  it('declares homelab.example with the apex and app A records, the www CNAME, the internal npm record and an SPF TXT record', () => {
    expect(DEMO_STACK.domains).toEqual({ homelab: { name: 'homelab.example' } });
    expect(Object.values(DEMO_STACK.dnsRecords).map(({ domain, name, type, value, view = 'public' }) => ({ domain, name, type, value, view })))
      .toEqual([
        { domain: 'homelab', name: '@', type: 'A', value: '203.0.113.10', view: 'public' },
        { domain: 'homelab', name: 'app', type: 'A', value: '203.0.113.10', view: 'public' },
        { domain: 'homelab', name: 'www', type: 'CNAME', value: 'homelab.example', view: 'public' },
        { domain: 'homelab', name: 'npm', type: 'A', value: '10.0.10.20', view: 'internal' },
        { domain: 'homelab', name: '@', type: 'TXT', value: 'v=spf1 -all', view: 'public' },
      ]);
  });

  it('routes homelab.example, www and app to the website on 3000 with force SSL, and npm.homelab.example to the admin port 81', () => {
    expect(DEMO_STACK.proxyRoutes).toEqual({
      website: {
        proxy: 'npm',
        hostnames: ['homelab.example', 'www.homelab.example', 'app.homelab.example'],
        upstream: 'website',
        forceSsl: true,
      },
      npmAdmin: { proxy: 'npm', hostnames: ['npm.homelab.example'], upstream: 'npmAdmin' },
    });
  });

  it('refers only to entities it declares', () => {
    const { sites, networks, hosts, services, listeners, domains, dnsRecords, proxyRoutes } = DEMO_STACK;
    const references = [
      ...Object.values(networks).map(({ site }) => [sites, site] as const),
      ...Object.values(hosts).flatMap(({ site, addresses }) => [
        [sites, site] as const,
        ...addresses.map(({ network }) => [networks, network] as const),
      ]),
      ...Object.values(services).map(({ host }) => [hosts, host] as const),
      ...Object.values(listeners).map(({ service }) => [services, service] as const),
      ...Object.values(dnsRecords).map(({ domain }) => [domains, domain] as const),
      ...Object.values(proxyRoutes).flatMap(({ proxy, upstream }) => [
        [services, proxy] as const,
        [listeners, upstream] as const,
      ]),
    ];

    expect(references.length).toBeGreaterThan(10);
    expect(references.filter(([declared, reference]) => reference !== null && !(reference in declared))).toEqual([]);
  });

  it('uses only fictional IPs and DNS names', () => {
    const { networks, hosts, listeners, domains, dnsRecords, proxyRoutes } = DEMO_STACK;
    const ips = [
      ...Object.values(networks).flatMap(({ cidr }) => (cidr ? [cidr] : [])),
      ...Object.values(hosts).flatMap(({ addresses }) => addresses.map(({ address }) => address)),
      ...Object.values(listeners).flatMap(({ bindAddress }) => (bindAddress ? [bindAddress] : [])),
      ...Object.values(dnsRecords).filter(({ type }) => type === 'A' || type === 'AAAA').map(({ value }) => value),
    ];
    const names = [
      ...Object.values(domains).map(({ name }) => name),
      ...Object.values(dnsRecords).filter(({ type }) => type === 'CNAME' || type === 'NS').map(({ value }) => value),
      ...Object.values(proxyRoutes).flatMap(({ hostnames }) => hostnames),
    ];

    expect(ips.length).toBeGreaterThan(5);
    expect(ips.filter((ip) => !isFictionalIp(ip))).toEqual([]);
    expect(names.filter((name) => !isFictionalDnsName(name))).toEqual([]);
  });
});
